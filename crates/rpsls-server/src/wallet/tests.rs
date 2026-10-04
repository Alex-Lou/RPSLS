use super::*;
use rand::rngs::StdRng;
use rand::SeedableRng;

const DAY: u64 = 86_400_000;

fn rich() -> Wallet {
    Wallet { eclats: 10_000, dust: 10_000, stars: 10_000, ..Default::default() }
}

#[test]
fn migration_keeps_balances_and_drops_junk() {
    let p = PlayerProgress {
        eclats: 120,
        dust: 40,
        stars: 30,
        card_collection: vec![
            "aegis".into(), "aegis".into(), "forged-card".into(), "apotheose-spectrale".into(),
            // Ni départ, ni bienvenue, ni déblocage → non repris (ligne client).
            "finisher-lame".into(), "acuite".into(),
            // Déblocage + bienvenue : repris.
            "mirror".into(), "gaia".into(),
        ],
        owned_premium_sets: vec!["quartz".into(), "forged-set".into()],
        codex_claimed: vec![20, 7],
        season_number: 3,
        season_started_at: 1_000,
        ..Default::default()
    };
    let w = Wallet::from_progress(&p, 5_000);
    assert_eq!((w.eclats, w.dust, w.stars), (120, 40, 30));
    // Doublon fusionné, id forgé, fusion et cartes hors départ/bienvenue/déblocage retirés.
    assert_eq!(w.card_collection, vec!["aegis".to_string(), "mirror".to_string(), "gaia".to_string()]);
    assert_eq!(w.level_rewarded, None, "base de niveau posée à la 1re réclamation");
    // Sets premium jamais repris (inaccessibles honnêtement).
    assert!(w.owned_premium_sets.is_empty());
    // 7 n'est pas un palier codex.
    assert_eq!(w.codex_claimed, vec![20]);
    assert_eq!((w.season_number, w.season_started_at), (3, 1_000));
    // Saison jamais posée / dans le futur → ramenée à « maintenant ».
    let fresh = Wallet::from_progress(&PlayerProgress::default(), 5_000);
    assert_eq!((fresh.season_number, fresh.season_started_at), (1, 5_000));
    let future = PlayerProgress { season_started_at: 9_999, ..Default::default() };
    assert_eq!(Wallet::from_progress(&future, 5_000).season_started_at, 5_000);
}

#[test]
fn migration_caps_inflated_balances() {
    let forged = PlayerProgress { eclats: 999_999, dust: 999_999, stars: 99_999, ..Default::default() };
    let w = Wallet::from_progress(&forged, 0);
    assert_eq!(
        (w.eclats, w.dust, w.stars),
        (MIGRATION_MAX_ECLATS, MIGRATION_MAX_DUST, economy::welcome_stars())
    );
}

#[test]
fn overlay_replaces_economy_fields() {
    let w = Wallet { eclats: 7, card_collection: vec!["aegis".into()], ..Default::default() };
    let mut p = PlayerProgress { eclats: 999_999, xp: 42, ..Default::default() };
    w.overlay_onto(&mut p);
    assert_eq!(p.eclats, 7);
    assert_eq!(p.card_collection, vec!["aegis".to_string()]);
    assert_eq!(p.xp, 42, "les champs hors éco ne sont pas touchés");
}

#[test]
fn open_pack_debits_rolls_packable_and_converts_duplicates() {
    let mut w = Wallet { eclats: economy::pack_cost() * 400, ..Default::default() };
    let mut rng = StdRng::seed_from_u64(7);
    let mut total_dust = 0;
    for _ in 0..400 {
        let r = w.open_pack(&mut rng).unwrap();
        assert_eq!(r.cards.len(), economy::pack_size());
        for (id, &new) in r.cards.iter().zip(&r.is_new) {
            assert!(economy::is_packable(id), "carte non tirable: {id}");
            if !new {
                assert!(w.card_collection.contains(id));
            }
        }
        total_dust += r.dust_gained;
    }
    assert_eq!(w.eclats, 0);
    assert_eq!(w.dust, total_dust);
    assert!(total_dust > 0, "400 packs sans doublon : improbable");
    assert_eq!(w.open_pack(&mut rng), Err(WalletError::Funds));
}

#[test]
fn craft_rules() {
    let mut w = Wallet { dust: economy::craft_cost("aegis").unwrap(), ..Default::default() };
    assert_eq!(w.craft("forged-card"), Err(WalletError::Unknown));
    assert_eq!(w.craft("apotheose-spectrale"), Err(WalletError::Unknown));
    // Finisher : collectionnable mais jamais deckable → plus forgeable.
    let mut r = rich();
    assert_eq!(r.craft("finisher-lame"), Err(WalletError::Unknown));
    assert_eq!(r.dust, 10_000);
    assert_eq!(w.craft("supernova"), Err(WalletError::Funds));
    assert_eq!(w.craft("aegis"), Ok(()));
    assert_eq!(w.dust, 0);
    assert_eq!(w.craft("aegis"), Err(WalletError::Owned));
}

#[test]
fn premium_set_rules() {
    let mut w = Wallet { stars: 300, ..Default::default() };
    assert_eq!(w.buy_premium_set("forged-set"), Err(WalletError::Unknown));
    assert_eq!(w.buy_premium_set("quartz"), Ok(())); // 300 ✦
    assert_eq!(w.stars, 0);
    assert_eq!(w.buy_premium_set("void"), Err(WalletError::Funds));
    let mut w2 = rich();
    w2.buy_premium_set("quartz").unwrap();
    assert_eq!(w2.buy_premium_set("quartz"), Err(WalletError::Owned));
}

#[test]
fn codex_rules() {
    let mut w = Wallet::default();
    assert_eq!(w.claim_codex(7), Err(WalletError::Unknown));
    assert_eq!(w.claim_codex(5), Err(WalletError::Unknown), "ancien palier");
    assert_eq!(w.claim_codex(20), Err(WalletError::NotEligible));
    let mut ids: Vec<&str> = economy::collectible_ids().into_iter().filter(|i| economy::is_packable(i)).collect();
    ids.sort_unstable();
    // 19 obtenables + 5 Finishers (forgés avant la règle) : les Finishers ne comptent pas.
    for id in ids.iter().take(19) {
        w.card_collection.push(id.to_string());
    }
    for f in ["finisher-lame", "finisher-calcul", "finisher-verger", "finisher-forteresse", "finisher-metamorphose"] {
        w.card_collection.push(f.into());
    }
    assert_eq!(w.claim_codex(20), Err(WalletError::NotEligible));
    w.card_collection.push(ids[19].to_string());
    assert_eq!(w.claim_codex(20), Ok(()));
    assert_eq!(w.eclats, 50);
    assert_eq!(w.claim_codex(20), Err(WalletError::Claimed));
    // Dernier palier = nombre de cartes obtenables (110), donc atteignable.
    assert_eq!(economy::codex_tiers().last().unwrap().threshold, ids.len());
}

#[test]
fn cpu_rewards_follow_scale_and_daily_cap() {
    let mut w = Wallet::default();
    let t = 100 * DAY + 5;
    assert_eq!(w.claim_cpu_reward("constellation", "win", None, false, t), Ok(12));
    assert_eq!(w.claim_cpu_reward("arena", "draw", None, false, t), Ok(20));
    assert_eq!(w.claim_cpu_reward("ranked", "loss", None, false, t), Ok(2));
    assert_eq!(w.claim_cpu_reward("bogus", "win", None, false, t), Err(WalletError::Unknown));
    assert_eq!(w.claim_cpu_reward("arena", "jackpot", None, false, t), Err(WalletError::Unknown));
    // Rafale : jamais plus que le plafond du jour.
    for _ in 0..100 {
        w.claim_cpu_reward("arena", "win", None, false, t).unwrap();
    }
    let cap = economy::cpu_eclats_daily_cap();
    assert_eq!(cap, 375);
    assert_eq!(w.eclats, cap);
    assert_eq!(w.claim_cpu_reward("arena", "win", None, false, t), Ok(0));
    // Jour UTC suivant : le compteur repart.
    assert_eq!(w.claim_cpu_reward("arena", "win", None, false, t + DAY), Ok(40));
    assert_eq!(w.eclats, cap + 40);
}

#[test]
fn cpu_rewards_reject_online_training_and_hotseat() {
    let mut w = Wallet::default();
    // "online" : arbitré par le serveur, jamais réclamable comme match CPU.
    assert_eq!(w.claim_cpu_reward("online", "win", Some(3), false, 0), Err(WalletError::Unknown));
    // Entraînement / hotseat : 0 💎 → mode inconnu pour une réclamation.
    assert_eq!(w.claim_cpu_reward("training", "win", Some(3), false, 0), Err(WalletError::Unknown));
    assert_eq!(w.claim_cpu_reward("hotseat", "loss", Some(3), false, 0), Err(WalletError::Unknown));
    assert_eq!(w.eclats, 0);
}

#[test]
fn cpu_rewards_apply_length_multiplier() {
    let mut w = Wallet::default();
    // Classé (15 💎) : Bo1 ×0.4, Bo3 ×1, Bo5 ×1.4, Bo7 ×1.8.
    assert_eq!(w.claim_cpu_reward("ranked", "win", Some(1), false, 0), Ok(6));
    assert_eq!(w.claim_cpu_reward("ranked", "win", Some(3), false, 0), Ok(15));
    assert_eq!(w.claim_cpu_reward("ranked", "win", Some(5), false, 0), Ok(21));
    assert_eq!(w.claim_cpu_reward("ranked", "win", Some(7), false, 0), Ok(27));
    // Défaite (2 💎) en Bo1 : 0.8 → 1 (arrondi = Math.round côté client).
    assert_eq!(w.claim_cpu_reward("casual", "loss", Some(1), false, 0), Ok(1));
    // Constellation (12 💎) : winTo 1 ×0.5, 2 ×1, 3 ×1.4.
    assert_eq!(w.claim_cpu_reward("constellation", "win", Some(1), false, 0), Ok(6));
    assert_eq!(w.claim_cpu_reward("constellation", "win", Some(2), false, 0), Ok(12));
    assert_eq!(w.claim_cpu_reward("constellation", "win", Some(3), false, 0), Ok(17));
    // Longueur inconnue → ×1 ; Arena : pas de multiplicateur.
    assert_eq!(w.claim_cpu_reward("ranked", "win", Some(9), false, 0), Ok(15));
    assert_eq!(w.claim_cpu_reward("arena", "win", Some(7), false, 0), Ok(40));
    assert_eq!(economy::length_mult_pct("online", Some(1)), 100);
}

fn reward(id: Option<&str>, mode: &str, outcome: &str) -> crate::protocol::CpuReward {
    crate::protocol::CpuReward {
        mode: mode.into(),
        outcome: outcome.into(),
        id: id.map(str::to_string),
        best_of: None,
        sweep: false,
    }
}

#[test]
fn cpu_claims_are_idempotent_by_id() {
    let mut w = Wallet::default();
    let batch = vec![reward(Some("a"), "ranked", "win"), reward(Some("b"), "ranked", "win")];
    assert_eq!(w.claim_cpu_batch(&batch, 0), 30);
    // Rejeu du même lot : rien.
    assert_eq!(w.claim_cpu_batch(&batch, 0), 0);
    // Doublon dans un même lot : compté une fois.
    let dup = vec![reward(Some("c"), "ranked", "win"), reward(Some("c"), "ranked", "win")];
    assert_eq!(w.claim_cpu_batch(&dup, 0), 15);
    // Une entrée refusée ne « brûle » pas son id.
    assert_eq!(w.claim_cpu_batch(&[reward(Some("d"), "online", "win")], 0), 0);
    assert!(!w.recent_claim_ids.contains(&"d".to_string()));
    // FIFO bornée.
    let many: Vec<_> = (0..150).map(|i| reward(Some(&format!("x{i}")), "ranked", "loss")).collect();
    w.claim_cpu_batch(&many, DAY);
    assert_eq!(w.recent_claim_ids.len(), RECENT_CLAIM_IDS);
    assert_eq!(w.recent_claim_ids.last().map(String::as_str), Some("x149"));
}

#[test]
fn unlocks_are_validated_against_server_counters() {
    let mut w = Wallet { card_collection: vec!["riposte".into()], ..Default::default() };
    // Aucune victoire comptée, LP serveur 1000 : rien ne passe.
    let ask: Vec<String> = ["riposte", "supernova", "heist", "razzia", "mirror", "vortex", "aegis", "forged"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    assert!(w.claim_unlocks(&ask, 1000).is_empty());
    // 3 victoires Constellation CPU (3 blanchissages) + LP serveur 1100.
    for _ in 0..3 {
        w.claim_cpu_reward("constellation", "win", Some(2), true, 0).unwrap();
    }
    assert_eq!((w.constell_wins, w.constell_sweeps), (3, 3));
    let added = w.claim_unlocks(&ask, 1100);
    assert_eq!(added, vec!["heist".to_string(), "razzia".into(), "mirror".into(), "vortex".into()]);
    // supernova exige 1500 LP serveur ; riposte déjà possédée ; aegis/forged hors liste.
    assert!(!w.card_collection.contains(&"supernova".to_string()));
    assert_eq!(w.claim_unlocks(&["supernova".into()], 1500), vec!["supernova".to_string()]);
}

#[test]
fn constell_wins_counted_at_most_ten_per_day() {
    let mut w = Wallet::default();
    for _ in 0..25 {
        w.claim_cpu_reward("arena", "win", None, false, 0).unwrap();
    }
    assert_eq!(w.constell_wins, MAX_CONSTELL_WINS_PER_DAY as u64);
    // Arena : toujours un blanchissage (journalisé 1-0 côté client).
    assert_eq!(w.constell_sweeps, MAX_CONSTELL_WINS_PER_DAY as u64);
    // Défaites et autres modes : non comptés.
    w.claim_cpu_reward("constellation", "loss", None, false, DAY).unwrap();
    w.claim_cpu_reward("ranked", "win", None, false, DAY).unwrap();
    assert_eq!(w.constell_wins, 10);
    w.count_constell_win(false, DAY);
    assert_eq!((w.constell_wins, w.constell_sweeps), (11, 10));
}

#[test]
fn level_rewards_are_rate_limited_and_never_retroactive() {
    // Portefeuille migré (base inconnue) : la 1re réclamation pose la base.
    let mut old = Wallet::default();
    assert_eq!(old.claim_level(30, 0), (0, 0));
    assert_eq!(old.level_rewarded, Some(30));
    assert_eq!(old.claim_level(31, 0), (economy::level_up_eclats(31), 10));
    assert_eq!(economy::level_up_eclats(31), 25 + 5 * 31);
    // Portefeuille neuf : niveaux payés depuis 1, au plus 5 par jour UTC.
    let mut w = Wallet::fresh(0);
    let (e, st) = w.claim_level(1_000_000, 0);
    assert_eq!(st, 5 * economy::level_up_stars());
    assert_eq!(e, (1..=5).map(economy::level_up_eclats).sum::<u64>());
    assert_eq!(w.level_rewarded, Some(5));
    assert_eq!(w.claim_level(1_000_000, 0), (0, 0), "plus de place aujourd'hui");
    // Le lendemain, la suite (niveaux 6..10).
    assert_eq!(w.claim_level(1_000_000, DAY).1, 50);
    assert_eq!(w.level_rewarded, Some(10));
    // Niveau déjà payé : rien.
    assert_eq!(w.claim_level(3, 2 * DAY), (0, 0));
}

#[test]
fn level_and_daily_eclats_share_the_cpu_cap() {
    let mut w = Wallet::fresh(0);
    for _ in 0..9 {
        w.claim_cpu_reward("arena", "win", None, false, 0).unwrap(); // 360 💎
    }
    let (e, st) = w.claim_level(1, 0);
    assert_eq!((e, st), (15, 10), "💎 rabotés au plafond, ✦ versées");
    assert_eq!(w.claim_daily("1970-01-01", "dc-a", 0), Ok(0));
    assert_eq!(w.eclats, 375);
}

fn epoch_day(date: &str) -> u64 {
    parse_date_key(date).unwrap() as u64
}

#[test]
fn daily_challenges_are_bounded() {
    let mut w = Wallet::default();
    let now = epoch_day("2026-10-04") * DAY + 3_600_000;
    assert_eq!(w.claim_daily("2026-10-04", "win-casual", now), Ok(25));
    assert_eq!(w.claim_daily("2026-10-04", "win-casual", now), Err(WalletError::Claimed));
    assert_eq!(w.claim_daily("2026-10-04", "b", now), Ok(25));
    assert_eq!(w.claim_daily("2026-10-04", "c", now), Ok(25));
    assert_eq!(w.claim_daily("2026-10-04", "d", now), Err(WalletError::NotEligible), "3 par date");
    // Fuseau : la veille / le lendemain passent, pas au-delà.
    assert_eq!(w.claim_daily("2026-10-05", "a", now), Ok(25));
    assert_eq!(w.claim_daily("2026-10-03", "a", now), Ok(25));
    assert_eq!(w.claim_daily("2026-10-07", "a", now), Err(WalletError::NotEligible));
    assert_eq!(w.claim_daily("2026-13-01", "a", now), Err(WalletError::Unknown));
    assert_eq!(w.claim_daily("2026-10-04", "../x", now), Err(WalletError::Unknown));
    // Les vieilles dates sont purgées (liste bornée).
    w.claim_daily("2026-10-10", "a", now + 6 * DAY).unwrap();
    assert!(w.daily_claims.iter().all(|k| k.as_str() >= "2026-10-08"));
}

#[test]
fn date_keys_parse_to_epoch_days() {
    assert_eq!(parse_date_key("1970-01-01"), Some(0));
    assert_eq!(parse_date_key("2026-10-04"), Some((WALLET_LAUNCH_MS / DAY) as i64));
    assert_eq!(parse_date_key("2024-03-01"), Some(19_783));
    assert_eq!(parse_date_key("2026-1-04"), None);
}

#[test]
fn initial_wallet_gating_by_identity_birth() {
    let forged = PlayerProgress {
        eclats: 99_999,
        dust: 99_999,
        card_collection: economy::collectible_ids().iter().map(|s| s.to_string()).collect(),
        ..Default::default()
    };
    // Identité NEUVE (née après le lancement) : la ligne client est ignorée.
    let w = store::build_initial(Some(WALLET_LAUNCH_MS + 1), Some(&forged), false, 7);
    assert_eq!((w.eclats, w.dust, w.stars), (0, 0, 0));
    assert_eq!(w.card_collection, economy::starter_cards().to_vec());
    assert_eq!(w.level_rewarded, Some(0));
    // … + bonus de bienvenue si le parcours compte l'a accordé (une seule fois).
    let mut wb = store::build_initial(Some(WALLET_LAUNCH_MS + 1), Some(&forged), true, 7);
    assert_eq!(wb.eclats, economy::welcome_eclats());
    assert_eq!(wb.card_collection.len(), crate::account::WELCOME_CARDS.len());
    wb.apply_welcome(crate::account::WELCOME_CARDS);
    assert_eq!(wb.eclats, economy::welcome_eclats(), "pas de double don");
    // Identité ANCIENNE (sans `born:` ou née avant) : migration BORNÉE.
    for born in [None, Some(WALLET_LAUNCH_MS - 1)] {
        let m = store::build_initial(born, Some(&forged), false, 7);
        assert_eq!((m.eclats, m.dust), (MIGRATION_MAX_ECLATS, MIGRATION_MAX_DUST));
        assert_eq!((MIGRATION_MAX_ECLATS, MIGRATION_MAX_DUST), (1_500, 500));
        assert!(m.card_collection.len() < 50, "collection bornée à départ ∪ bienvenue ∪ déblocages");
        assert!(m.card_collection.contains(&"supernova".to_string()));
        assert!(!m.card_collection.contains(&"acuite".to_string()));
    }
    // Identité ancienne SANS ligne : portefeuille neuf.
    assert_eq!(store::build_initial(None, None, false, 7).card_collection, economy::starter_cards().to_vec());
}

#[tokio::test]
async fn new_identity_never_migrates_its_client_row() {
    crate::test_upstash::ensure();
    // Identité neuve : jeton créé maintenant → `born:` posé par le serveur.
    let pid = "wallet-test-newborn-0000000000000000";
    assert!(crate::player_state::try_create_claim_token(pid).await.unwrap().is_some());
    // La ligne player forgée par le client (SyncState) déclare tout.
    let forged = PlayerProgress {
        eclats: 99_999,
        card_collection: economy::collectible_ids().iter().map(|s| s.to_string()).collect(),
        ..Default::default()
    };
    crate::test_upstash::put(&format!("player:{pid}"), &serde_json::to_string(&forged).unwrap());
    // Même via l'activation forcée du Hello (ligne existante) : portefeuille neuf.
    let mut p = forged.clone();
    super::handlers::ensure_and_overlay(pid, &mut p, true).await;
    assert_eq!(p.eclats, 0);
    assert_eq!(p.card_collection, economy::starter_cards().to_vec());
}

#[test]
fn season_uses_server_clock_and_lp_tier() {
    let start = 1_000;
    let mut w = Wallet { season_number: 2, season_started_at: start, ..Default::default() };
    let end = start + economy::season_duration_ms();
    assert_eq!(w.claim_season(2_000, end - 1), Err(WalletError::NotEligible));
    assert_eq!(w.claim_season(2_000, end), Ok((700, 200, 100))); // diamond
    assert_eq!(w.stars, 100);
    assert_eq!((w.season_number, w.season_started_at), (3, end));
    // Saison suivante pas encore finie : pas de double réclamation.
    assert_eq!(w.claim_season(2_000, end + 1), Err(WalletError::NotEligible));
    let mut b = Wallet { season_started_at: 0, ..Default::default() };
    assert_eq!(b.claim_season(0, economy::season_duration_ms()), Ok((50, 0, 10))); // bronze
}

#[test]
fn welcome_adds_currencies_and_cards() {
    let mut w = Wallet { card_collection: vec!["aegis".into()], ..Default::default() };
    w.apply_welcome(&["aegis", "heist"]);
    assert_eq!(
        (w.eclats, w.dust, w.stars),
        (economy::welcome_eclats(), economy::welcome_dust(), economy::welcome_stars())
    );
    assert_eq!(w.card_collection, vec!["aegis".to_string(), "heist".to_string()]);
}

/* ── Stockage (faux Upstash en mémoire, cf. test_upstash) ── */

#[tokio::test]
async fn store_migrates_once_then_serializes_spending() {
    crate::test_upstash::ensure();
    let pid = "wallet-test-migrate";
    // Ligne player existante : c'est elle qui sert de solde de départ.
    let row = PlayerProgress { eclats: economy::pack_cost() * 2, card_collection: vec!["aegis".into()], ..Default::default() };
    crate::test_upstash::put(&format!("player:{pid}"), &serde_json::to_string(&row).unwrap());

    // Pas encore de portefeuille : les opérations sont refusées.
    let mut rng = rand::rngs::StdRng::seed_from_u64(1);
    assert_eq!(
        store::update(pid, |w| w.open_pack(&mut rng)).await.err(),
        Some(store::StoreError::NotInitialized)
    );

    let w = store::init(pid).await.unwrap();
    assert_eq!(w.eclats, economy::pack_cost() * 2);
    // Init idempotent : la ligne player modifiée ensuite n'est PLUS relue.
    let forged = PlayerProgress { eclats: 9_999_999, ..Default::default() };
    crate::test_upstash::put(&format!("player:{pid}"), &serde_json::to_string(&forged).unwrap());
    assert_eq!(store::init(pid).await.unwrap().eclats, economy::pack_cost() * 2);

    // 10 ouvertures concurrentes pour un solde de 2 packs : exactement 2 passent.
    let tasks: Vec<_> = (0..10)
        .map(|i| {
            tokio::spawn(async move {
                let mut rng = rand::rngs::StdRng::seed_from_u64(i);
                store::update(pid, |w| w.open_pack(&mut rng)).await.is_ok()
            })
        })
        .collect();
    let mut ok = 0;
    for t in tasks {
        if t.await.unwrap() {
            ok += 1;
        }
    }
    assert_eq!(ok, 2, "le verrou par joueur doit empêcher la double dépense");
    assert_eq!(store::get(pid).await.unwrap().unwrap().eclats, 0);
}

#[tokio::test]
async fn unreadable_wallet_is_an_error_never_recreated() {
    crate::test_upstash::ensure();
    let pid = "wallet-test-corrupt";
    crate::test_upstash::put(&format!("wallet:{pid}"), "{not json");
    assert_eq!(store::init(pid).await.err(), Some(store::StoreError::Backend));
    // La ligne n'a pas été écrasée par une migration.
    assert_eq!(crate::test_upstash::read(&format!("wallet:{pid}")).as_deref(), Some("{not json"));
}

#[tokio::test]
async fn hello_forces_wallet_only_for_existing_rows() {
    crate::test_upstash::ensure();
    // Joueur existant sur l'ancien flux : ligne player, pas de portefeuille.
    let pid = "wallet-test-forced";
    let row = PlayerProgress { eclats: 120, card_collection: vec!["aegis".into()], ..Default::default() };
    crate::test_upstash::put(&format!("player:{pid}"), &serde_json::to_string(&row).unwrap());
    let mut p = row.clone();
    super::handlers::ensure_and_overlay(pid, &mut p, true).await;
    let w = store::get(pid).await.unwrap().expect("portefeuille créé au Hello");
    assert_eq!((w.eclats, p.eclats), (120, 120));
    // Ensuite la ligne player (écrite par l'app) ne fait plus foi.
    let mut forged = PlayerProgress { eclats: 9_999_999, ..Default::default() };
    super::handlers::ensure_and_overlay(pid, &mut forged, true).await;
    assert_eq!(forged.eclats, 120);
    assert_eq!(forged.card_collection, vec!["aegis".to_string()]);

    // Joueur tout neuf (aucune ligne) : rien n'est créé, l'app migrera son état local.
    let fresh = "wallet-test-fresh";
    let mut empty = PlayerProgress::default();
    super::handlers::ensure_and_overlay(fresh, &mut empty, false).await;
    assert!(store::get(fresh).await.unwrap().is_none());
}

#[test]
fn forfeit_loser_earns_nothing_in_every_mode() {
    use super::handlers::match_reward;
    for mode in ["online", "constellation", "arena"] {
        assert_eq!(match_reward(mode, "loss", true), 0, "{mode}");
        assert_eq!(match_reward(mode, "win", true), match_reward(mode, "win", false), "{mode}");
    }
    // Défaite « normale » en Arena : toujours payée (comme recordArenaMatch).
    assert_eq!(match_reward("arena", "loss", false), economy::arena_eclats("loss"));
    assert!(match_reward("arena", "loss", false) > 0);
}
