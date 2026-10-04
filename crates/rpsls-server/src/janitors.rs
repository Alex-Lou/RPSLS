//! Background janitors — periodic sweepers spawned once at boot. Extracted from
//! main.rs to keep the entry point lean (audit 2026-06-14, règle <400 lignes).
//!
//! Each `spawn_*` detaches a tokio task that ticks forever; they own only what
//! they need (a cheap `Arc<AppState>` clone, or nothing for the Redis sweeper).

use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{debug, info, warn};

use crate::player_state;
use crate::AppState;

/// Sort d'un joueur au passage du janitor des inactifs.
#[derive(Debug, PartialEq, Eq)]
enum Verdict {
    Keep,
    /// Joueur antérieur au marquage `seen:` : on démarre son délai maintenant
    /// (il ne pourra être supprimé que dans INACTIVE_TTL_DAYS, s'il ne revient pas).
    StampNow,
    Delete,
}

/// Décision PURE. Ne supprime jamais : un compte (e-mail/Google), un joueur qui
/// détient du contenu payant, un joueur actif récemment.
fn verdict(account_holder: bool, paid: bool, seen: Option<u64>, cutoff_ms: u64) -> Verdict {
    if account_holder || paid {
        return Verdict::Keep;
    }
    match seen {
        None => Verdict::StampNow,
        Some(ts) if ts >= cutoff_ms => Verdict::Keep,
        Some(_) => Verdict::Delete,
    }
}

/// Contenu payant dans le portefeuille : étoiles au-delà du bonus de bienvenue,
/// ou un set premium. (Aucun paiement réel aujourd'hui ; garde-fou pour l'IAP.)
fn holds_paid_content(w: &crate::wallet::Wallet) -> bool {
    w.stars > crate::economy::welcome_stars() || !w.owned_premium_sets.is_empty()
}

/// Inactive-user sweeper: every 24h, SCAN `player:*` and delete the GUESTS
/// inactive for INACTIVE_TTL_DAYS. Activity = `seen:{pid}`, stamped by the
/// SERVER at each authenticated session (the old `updatedAt` was written by the
/// client — a bogus value could erase a live account). Any backend error on a
/// player → skipped, never deleted. Bounded: we sleep between SCAN pages so a
/// sudden 100k-key sweep can't burn through the Upstash request budget.
pub fn spawn_inactive_user_sweeper() {
    tokio::spawn(async move {
        const INACTIVE_TTL_DAYS: u64 = 180;
        const SWEEP_INTERVAL_SECS: u64 = 24 * 3600;
        const SCAN_PAGE: u32 = 200;
        const PAGE_PAUSE_MS: u64 = 250;
        let ttl_ms: u64 = INACTIVE_TTL_DAYS * 24 * 3600 * 1000;
        // Skip the immediate first tick — boot-time bursts are bad form.
        let mut tick = tokio::time::interval(Duration::from_secs(SWEEP_INTERVAL_SECS));
        tick.tick().await;
        loop {
            tick.tick().await;
            if !player_state::enabled() {
                continue;
            }
            let now_ms = crate::wallet::store::now_ms();
            let cutoff_ms = now_ms.saturating_sub(ttl_ms);
            let mut cursor = "0".to_string();
            let (mut deleted, mut scanned, mut stamped) = (0u32, 0u32, 0u32);
            loop {
                let Some((next, keys)) = player_state::scan_player_keys(&cursor, SCAN_PAGE).await else {
                    break;
                };
                scanned += keys.len() as u32;
                let pids: Vec<&str> = keys.iter().filter_map(|k| player_state::player_id_from_key(k)).collect();
                // Activité de TOUTE la page en une commande. Un joueur actif
                // (la grande majorité) est gardé sans aucune autre lecture ;
                // les vérifs coûteuses (compte, portefeuille) ne visent que les
                // candidats. Avant : ~4 commandes PAR joueur inscrit, chaque jour.
                // Erreur backend → liste vide → page sautée, rien supprimé.
                let seens = player_state::read_seen_many(&pids).await.unwrap_or_default();
                for (pid, seen) in pids.iter().copied().zip(seens) {
                    if matches!(seen, Some(ts) if ts >= cutoff_ms) {
                        continue; // actif récemment → Keep (verdict identique)
                    }
                    let (Ok(holder), Ok(wallet)) = (
                        crate::account::is_account_holder(pid).await,
                        crate::wallet::store::get(pid).await,
                    ) else {
                        continue; // erreur backend → on ne touche à rien
                    };
                    let paid = wallet.as_ref().is_some_and(holds_paid_content);
                    match verdict(holder, paid, seen, cutoff_ms) {
                        Verdict::Keep => {}
                        Verdict::StampNow => {
                            if player_state::set_seen(pid, now_ms).await.is_ok() {
                                stamped += 1;
                            }
                        }
                        Verdict::Delete => {
                            if player_state::delete_player(pid).await {
                                deleted += 1;
                            }
                        }
                    }
                }
                cursor = next;
                if cursor == "0" { break }
                tokio::time::sleep(Duration::from_millis(PAGE_PAUSE_MS)).await;
            }
            info!(scanned, deleted, stamped, days = INACTIVE_TTL_DAYS, "inactive-user sweep done");
        }
    });
}

/// SyncState throttle-map sweeper: each player_id who ever pushed leaves an
/// Instant entry; without pruning the map grows monotonically. 60s sweep drops
/// entries older than 60s (12× the 5s throttle window — well past any legit
/// cooldown), so the map's upper bound tracks the concurrent pusher count
/// rather than the sweep interval.
pub fn spawn_sync_throttle_sweeper(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(60));
        tick.tick().await; // skip first immediate tick
        loop {
            tick.tick().await;
            let cutoff = Duration::from_secs(60);
            let now = Instant::now();
            let stale: Vec<String> = state
                .sync_throttle
                .iter()
                .filter(|e| now.duration_since(*e.value()) >= cutoff)
                .map(|e| e.key().clone())
                .collect();
            for pid in &stale {
                state
                    .sync_throttle
                    .remove_if(pid, |_, v| now.duration_since(*v) >= cutoff);
            }
            if !stale.is_empty() {
                debug!(removed = stale.len(), "sync throttle swept");
            }
        }
    });
}

/// Dead-match janitor: `on_end` runs when a match task exits cleanly, but a
/// panic inside run_match (e.g. a channel send failure) skips on_end and leaves
/// the in_match / in_lanes entries forever — a slow leak over weeks of uptime.
/// Every 2 min, scan both maps and drop entries whose command sender is closed
/// (a closed sender means the match task is gone, so cleanup is safe + idempotent).
pub fn spawn_dead_match_sweeper(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(120));
        tick.tick().await;
        loop {
            tick.tick().await;
            let dead_classic: Vec<String> = state
                .in_match
                .iter()
                .filter(|e| e.value().0.is_closed())
                .map(|e| e.key().clone())
                .collect();
            let dead_lanes: Vec<String> = state
                .in_lanes
                .iter()
                .filter(|e| e.value().0.is_closed())
                .map(|e| e.key().clone())
                .collect();
            // CCG (Constellation Pro en ligne) : oublié jusqu'ici → une entrée
            // morte comptait à vie dans le plafond de matchs simultanés.
            let dead_ccg: Vec<String> = state
                .in_ccg
                .iter()
                .filter(|e| e.value().0.is_closed())
                .map(|e| e.key().clone())
                .collect();
            let total = dead_classic.len() + dead_lanes.len() + dead_ccg.len();
            for id in &dead_classic {
                state.in_match.remove_if(id, |_, v| v.0.is_closed());
            }
            for id in &dead_lanes {
                state.in_lanes.remove_if(id, |_, v| v.0.is_closed());
            }
            for id in &dead_ccg {
                state.in_ccg.remove_if(id, |_, v| v.0.is_closed());
            }
            if total > 0 {
                warn!(removed = total, "dead match channels swept (on_end skipped?)");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const CUTOFF: u64 = 1_000;

    #[test]
    fn accounts_and_paid_players_are_never_deleted() {
        assert_eq!(verdict(true, false, Some(0), CUTOFF), Verdict::Keep);
        assert_eq!(verdict(false, true, Some(0), CUTOFF), Verdict::Keep);
        assert_eq!(verdict(true, false, None, CUTOFF), Verdict::Keep);
    }

    #[test]
    fn guests_follow_server_activity() {
        assert_eq!(verdict(false, false, Some(CUTOFF), CUTOFF), Verdict::Keep);
        assert_eq!(verdict(false, false, Some(CUTOFF - 1), CUTOFF), Verdict::Delete);
        // Jamais vu (antérieur au marquage) : délai démarré, pas supprimé.
        assert_eq!(verdict(false, false, None, CUTOFF), Verdict::StampNow);
    }

    #[test]
    fn paid_content_detection() {
        use crate::wallet::Wallet;
        let welcome = crate::economy::welcome_stars();
        assert!(!holds_paid_content(&Wallet { stars: welcome, ..Default::default() }));
        assert!(holds_paid_content(&Wallet { stars: welcome + 1, ..Default::default() }));
        assert!(holds_paid_content(&Wallet { owned_premium_sets: vec!["quartz".into()], ..Default::default() }));
    }
}
