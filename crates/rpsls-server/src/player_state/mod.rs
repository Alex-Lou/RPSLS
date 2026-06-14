//! Player state persistence via Upstash Redis REST API.
//!
//! Stores player progression (currencies, XP, cards, stats) so it survives
//! app reinstalls. Uses the same Upstash credentials as the leaderboard.
//!
//! Redis key: `player:{player_id}` — stores a JSON blob of the synced fields.
//! Reads are awaited (blocking on Hello); writes are fire-and-forget.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::warn;

const KEY_PREFIX: &str = "player:";
const CLAIM_PREFIX: &str = "claim:";

// Persistance Upstash (config/http/enabled + fonctions REST) extraite dans le
// sous-module `redis` ; ré-exportée pour garder l'API publique `player_state::*`
// identique (aucun appelant — dispatch/hello/janitors/account/main — n'est touché).
mod redis;
pub use redis::*;

/// Daily-challenge claim tracker — which daily quest ids were claimed on a given
/// day. Mirrors the client's `Player.dailyClaims`. Date-scoped: the client only
/// honours it when `date` is today, so a stale tracker self-expires.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DailyClaims {
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub ids: Vec<String>,
}

/// Per-move pick/win tally (one entry per RPSLS move). Mirrors the client's
/// `ByMoveStat`. The server only stores/returns it; the pentagram-quest merge
/// (max per field) runs client-side.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ByMoveStat {
    #[serde(default)]
    pub picked: u64,
    #[serde(default)]
    pub won: u64,
}

/// Abandon record (pénalité de forfait, fenêtre glissante 24h). Mirror du
/// `AbandonRecord` client. Le serveur ne fait que le stocker/retourner ; le merge
/// anti-reset (max) tourne côté client (cf. match/forfeit.ts).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AbandonRecord {
    #[serde(default)]
    pub count: u64,
    #[serde(default)]
    pub last_at: u64,
}

/// The subset of player state that we persist server-side: progression data
/// PLUS the player's small cosmetic preferences (theme / background / pad /
/// avatar / nickname) so a reinstall restores the chosen look. Bulky custom
/// uploaded images (data: URLs) are deliberately NOT synced — they stay
/// device-local; `sanitize` drops anything that slips past via the length cap.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProgress {
    #[serde(default)]
    pub xp: u64,
    #[serde(default)]
    pub rank_lp: u64,
    #[serde(default)]
    pub eclats: u64,
    #[serde(default)]
    pub dust: u64,
    /// Premium currency (✦). Synced so unspent stars survive a reinstall — same
    /// durability guarantee as eclats/dust.
    #[serde(default)]
    pub stars: u64,
    #[serde(default)]
    pub wins: u64,
    #[serde(default)]
    pub losses: u64,
    #[serde(default)]
    pub draws: u64,
    #[serde(default)]
    pub card_collection: Vec<String>,
    #[serde(default)]
    pub card_mastery: HashMap<String, u64>,
    #[serde(default)]
    pub codex_claimed: Vec<u32>,
    /// One-time quest claim ids — union-merged on the client so rewards can't
    /// be re-claimed after a reinstall.
    #[serde(default)]
    pub claimed_quests: Vec<String>,
    #[serde(default)]
    pub ranked_deck: Vec<String>,
    /// Arena (Constellation Pro) deck — separate from Classé. Synced so it
    /// survives a reinstall exactly like `ranked_deck`. Alex 2026-06-13: Arena
    /// data was being SILENTLY DROPPED server-side because this field (and the
    /// arena_* record below) were missing from the struct — serde ignores the
    /// `arenaDeck` the client sends, so the deck only ever lived in localStorage
    /// and was lost on every reinstall.
    #[serde(default)]
    pub arena_deck: Vec<String>,
    /// Premium cosmetic sets the player has purchased. Synced (union) so a
    /// reinstall never loses paid sets — same durability guarantee as cards.
    #[serde(default)]
    pub owned_premium_sets: Vec<String>,
    #[serde(default)]
    pub season_number: u32,
    #[serde(default)]
    pub season_started_at: u64,
    #[serde(default)]
    pub win_streak: u32,
    /// Classé (classic 1v1) own ladder + record — cloud-saved like the rest of
    /// the progression so it survives reinstall and follows the player across
    /// devices.
    #[serde(default)]
    pub classe_lp: u64,
    #[serde(default)]
    pub classe_wins: u64,
    #[serde(default)]
    pub classe_losses: u64,
    #[serde(default)]
    pub classe_draws: u64,
    /// Constellation Pro (arena) record — cloud-saved like classe_* so the
    /// Arena win/loss/draw tally survives a reinstall. Was dropped server-side
    /// (field missing) → Arena stats never persisted (Alex 2026-06-13).
    #[serde(default)]
    pub arena_wins: u64,
    #[serde(default)]
    pub arena_losses: u64,
    #[serde(default)]
    pub arena_draws: u64,
    /// Epoch millis of last sync — used for last-write-wins on cosmetics.
    #[serde(default)]
    pub updated_at: u64,

    // ── Cosmetic preferences (small strings; empty = "unset") ──
    #[serde(default)]
    pub theme_id: String,
    #[serde(default)]
    pub background_id: String,
    #[serde(default)]
    pub pad_id: String,
    #[serde(default)]
    pub avatar: String,
    #[serde(default)]
    pub nickname: String,

    // ── Gameplay / accessibility prefs (0 / empty / false = "unset") ──
    #[serde(default)]
    pub difficulty: String,
    /// UI font scale multiplier (1.0 = default). 0.0 means "never set on this
    /// device" — the client only ADOPTS values >= 1.
    #[serde(default)]
    pub font_scale: f32,
    /// True once the player has explicitly picked a pad — gates the first-run
    /// chooser from popping back on a re-install.
    #[serde(default)]
    pub pad_chosen: bool,

    /// Recent match history (opaque JSON `MatchRecord`s, capped to 60 in
    /// sanitize). Synced so the player's match LOG + the chosen Voies survive a
    /// reinstall (Alex 2026-06-13: history was localStorage-only → lost on
    /// every reinstall). The server only stores/returns it — it never inspects
    /// the records.
    #[serde(default)]
    pub history: Vec<serde_json::Value>,

    // ── Champs de progression réparés 2026-06-14 : ils existaient côté client
    // mais étaient ABSENTS de cette struct → jamais persistés → perdus à chaque
    // install propre (défis du jour re-réclamables, quête pentagramme + Voie
    // réinitialisées). Même classe de bug que arena_deck/arena_* (cf. data-persistence). ──
    /// Défis du jour réclamés aujourd'hui (scopé au jour ; expire à minuit).
    #[serde(default)]
    pub daily_claims: DailyClaims,
    /// Clés de date (YYYY-MM-DD) des jours dont le set de défis est complété.
    #[serde(default)]
    pub completed_dailies: Vec<String>,
    /// Tally pick/win par coup — alimente la quête pentagramme (gagner 1× avec chacun).
    #[serde(default)]
    pub by_move: HashMap<String, ByMoveStat>,
    /// Voie / affinité choisie en Constellation Pro (coup RPSLS).
    #[serde(default)]
    pub arena_affinity: String,
    /// Compteur d'abandons (pénalité forfait, fenêtre 24h) — persisté pour qu'un
    /// quitteur ne réinitialise pas sa pénalité en réinstallant.
    #[serde(default)]
    pub abandons: AbandonRecord,
}

/// Hard ceiling for any single numeric progression field — well above any
/// legitimate value, but bounds a forged `u64::MAX` payload.
const MAX_NUM: u64 = 10_000_000_000;

fn clamp_str(s: &mut String, max: usize) {
    if s.chars().count() > max {
        *s = s.chars().take(max).collect();
    }
}

fn cap_vec(v: &mut Vec<String>, max_len: usize, max_str: usize) {
    v.truncate(max_len);
    for s in v.iter_mut() {
        clamp_str(s, max_str);
    }
}

impl PlayerProgress {
    /// Clamp every field to sane bounds before persisting. A `SyncState` is
    /// fully client-authored, so without this a crafted payload could poison
    /// Redis (junk card ids, giant arrays) or inflate storage/egress. Numbers
    /// are capped, arrays length-bounded, strings truncated. Cosmetic strings
    /// are length-capped here; the client additionally only ADOPTS a server
    /// cosmetic value that maps to a known id, so any junk that survives the
    /// cap is inert on read.
    pub fn sanitize(&mut self) {
        self.xp = self.xp.min(MAX_NUM);
        // rank_lp is a competitive number — diamond tier opens at 1750 (see
        // engine/rank.ts). A 5000 ceiling leaves room for future tiers without
        // letting a tampered client mint billions for season-rollover rewards.
        // Server-issued LP from real online matches already lives well below.
        self.rank_lp = self.rank_lp.min(5_000);
        self.eclats = self.eclats.min(MAX_NUM);
        self.dust = self.dust.min(MAX_NUM);
        self.stars = self.stars.min(MAX_NUM);
        self.wins = self.wins.min(MAX_NUM);
        self.losses = self.losses.min(MAX_NUM);
        self.draws = self.draws.min(MAX_NUM);
        // Classé runs its own ladder on the same 5000 ceiling as ranked.
        self.classe_lp = self.classe_lp.min(5_000);
        self.classe_wins = self.classe_wins.min(MAX_NUM);
        self.classe_losses = self.classe_losses.min(MAX_NUM);
        self.classe_draws = self.classe_draws.min(MAX_NUM);
        self.arena_wins = self.arena_wins.min(MAX_NUM);
        self.arena_losses = self.arena_losses.min(MAX_NUM);
        self.arena_draws = self.arena_draws.min(MAX_NUM);
        self.season_number = self.season_number.min(100_000);
        self.win_streak = self.win_streak.min(100_000);

        // 256 = bien au-dessus des ~79 cartes collectionnables (Alex 2026-06-13 :
        // 64 TRONQUAIT la collection d'un joueur avancé → cartes PERDUES au sync /
        // réinstall). Marge confortable pour les cartes futures ; les ids sont
        // courts (≤64 char) → coût Redis négligeable.
        cap_vec(&mut self.card_collection, 256, 64);
        cap_vec(&mut self.ranked_deck, 16, 64);
        cap_vec(&mut self.arena_deck, 16, 64);
        // History: bound the COUNT so the Redis blob stays small (each
        // MatchRecord is a few hundred bytes; 60 is plenty for a match log).
        // Opaque JSON — records are client-authored; the count cap is the guard.
        self.history.truncate(60);
        cap_vec(&mut self.owned_premium_sets, 32, 32);
        // Whitelist anti-forge : retire les sets premium INCONNUS (un sync
        // trafiqué qui s'octroie tous les cosmétiques payants). Un set légitime
        // est TOUJOURS dans themes.ts → jamais perdu. ⚠️ Ajouter un set premium =
        // relancer scripts/gen-economy-meta.mjs, sinon le serveur le retirerait.
        let before_sets = self.owned_premium_sets.len();
        self.owned_premium_sets
            .retain(|s| crate::economy::is_premium_set(s));
        if self.owned_premium_sets.len() < before_sets {
            warn!(
                dropped = before_sets - self.owned_premium_sets.len(),
                "owned_premium_sets : ids inconnus retirés (forge ou economy_meta périmé)"
            );
        }
        // Quests accumulate over seasons of play — 128 ids is plenty without
        // letting a tampered client blow up Redis storage.
        cap_vec(&mut self.claimed_quests, 128, 64);
        self.codex_claimed.truncate(32);
        if self.card_mastery.len() > 256 {
            let keep: std::collections::HashSet<String> =
                self.card_mastery.keys().take(256).cloned().collect();
            self.card_mastery.retain(|k, _| keep.contains(k));
        }
        for v in self.card_mastery.values_mut() {
            *v = (*v).min(MAX_NUM);
        }

        // Daily / progression (ajoutés 2026-06-14) : borne les tailles pour qu'un
        // payload forgé ne puisse pas gonfler Redis. Valeurs à faible enjeu
        // (progression de quête) — on clamp sans valider la légalité.
        clamp_str(&mut self.daily_claims.date, 10);
        cap_vec(&mut self.daily_claims.ids, 8, 64);
        cap_vec(&mut self.completed_dailies, 400, 10);
        if self.by_move.len() > 16 {
            let keep: std::collections::HashSet<String> =
                self.by_move.keys().take(16).cloned().collect();
            self.by_move.retain(|k, _| keep.contains(k));
        }
        for s in self.by_move.values_mut() {
            s.picked = s.picked.min(MAX_NUM);
            s.won = s.won.min(MAX_NUM);
        }
        clamp_str(&mut self.arena_affinity, 16);
        // Abandon count : borne anti-junk (la pénalité est de toute façon capée à
        // -25 côté client). NE PAS clamper `last_at` : c'est un timestamp ms, et
        // MAX_NUM (1e10) est INFÉRIEUR à un vrai timestamp → le clamper corromprait
        // la fenêtre glissante. Un last_at forgé est inerte (au pire auto-pénalité).
        self.abandons.count = self.abandons.count.min(MAX_NUM);

        clamp_str(&mut self.theme_id, 32);
        clamp_str(&mut self.background_id, 32);
        clamp_str(&mut self.pad_id, 32);
        clamp_str(&mut self.avatar, 300);
        clamp_str(&mut self.nickname, 24);
        clamp_str(&mut self.difficulty, 16);
        // font_scale: NaN/Inf/negative → "unset" (0). Cap legit values at 2x
        // so a tampered client can't ship 1e30 and break the UI on adopt.
        if !self.font_scale.is_finite() || self.font_scale < 0.0 {
            self.font_scale = 0.0;
        } else if self.font_scale > 2.0 {
            self.font_scale = 2.0;
        }
    }
}
