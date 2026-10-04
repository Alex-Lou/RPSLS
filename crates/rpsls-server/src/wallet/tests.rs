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
        card_collection: vec!["aegis".into(), "aegis".into(), "forged-card".into(), "apotheose-spectrale".into()],
        owned_premium_sets: vec!["quartz".into(), "forged-set".into()],
        codex_claimed: vec![5, 7],
        season_number: 3,
        season_started_at: 1_000,
        ..Default::default()
    };
    let w = Wallet::from_progress(&p, 5_000);
    assert_eq!((w.eclats, w.dust, w.stars), (120, 40, 30));
    // Doublon fusionné, id forgé et fusion (non collectionnable) retirés.
    assert_eq!(w.card_collection, vec!["aegis".to_string()]);
    // Sets premium jamais repris (inaccessibles honnêtement).
    assert!(w.owned_premium_sets.is_empty());
    // 7 n'est pas un palier codex.
    assert_eq!(w.codex_claimed, vec![5]);
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
    assert_eq!(w.craft("supernova"), Err(WalletError::Funds));
    assert_eq!(w.craft("aegis"), Ok(()));
    assert_eq!(w.dust, 0);
    assert_eq!(w.craft("aegis"), Err(WalletError::Owned));
}

#[test]
fn premium_set_rules() {
    let mut w = Wallet { stars: 800, ..Default::default() };
    assert_eq!(w.buy_premium_set("forged-set"), Err(WalletError::Unknown));
    assert_eq!(w.buy_premium_set("void"), Err(WalletError::Funds)); // 900 ✦
    assert_eq!(w.buy_premium_set("quartz"), Ok(()));
    assert_eq!(w.stars, 0);
    let mut w2 = rich();
    w2.buy_premium_set("quartz").unwrap();
    assert_eq!(w2.buy_premium_set("quartz"), Err(WalletError::Owned));
}

#[test]
fn codex_rules() {
    let mut w = Wallet::default();
    assert_eq!(w.claim_codex(7), Err(WalletError::Unknown));
    assert_eq!(w.claim_codex(5), Err(WalletError::NotEligible));
    for id in ["aegis", "precision", "anchor", "second-wind", "surge"] {
        w.card_collection.push(id.into());
    }
    assert_eq!(w.claim_codex(5), Ok(()));
    assert_eq!(w.eclats, 50);
    assert_eq!(w.claim_codex(5), Err(WalletError::Claimed));
}

#[test]
fn cpu_rewards_follow_scale_and_daily_cap() {
    let mut w = Wallet::default();
    let t = 100 * DAY + 5;
    assert_eq!(w.claim_cpu_reward("constellation", "win", t), Ok(12));
    assert_eq!(w.claim_cpu_reward("arena", "draw", t), Ok(10));
    assert_eq!(w.claim_cpu_reward("ranked", "loss", t), Ok(2));
    assert_eq!(w.claim_cpu_reward("bogus", "win", t), Err(WalletError::Unknown));
    assert_eq!(w.claim_cpu_reward("arena", "jackpot", t), Err(WalletError::Unknown));
    // Rafale : jamais plus que le plafond du jour.
    for _ in 0..100 {
        w.claim_cpu_reward("arena", "win", t).unwrap();
    }
    let cap = economy::cpu_eclats_daily_cap();
    assert_eq!(w.eclats, cap);
    assert_eq!(w.claim_cpu_reward("arena", "win", t), Ok(0));
    // Jour UTC suivant : le compteur repart.
    assert_eq!(w.claim_cpu_reward("arena", "win", t + DAY), Ok(20));
    assert_eq!(w.eclats, cap + 20);
}

#[test]
fn unlocks_only_accept_listed_cards() {
    let mut w = Wallet { card_collection: vec!["riposte".into()], ..Default::default() };
    let added = w.claim_unlocks(&["riposte".into(), "supernova".into(), "aegis".into(), "forged".into()]);
    assert_eq!(added, vec!["supernova".to_string()]);
    assert_eq!(w.card_collection.len(), 2);
}

#[test]
fn season_uses_server_clock_and_lp_tier() {
    let start = 1_000;
    let mut w = Wallet { season_number: 2, season_started_at: start, ..Default::default() };
    let end = start + economy::season_duration_ms();
    assert_eq!(w.claim_season(2_000, end - 1), Err(WalletError::NotEligible));
    assert_eq!(w.claim_season(2_000, end), Ok((700, 200))); // diamond
    assert_eq!((w.season_number, w.season_started_at), (3, end));
    // Saison suivante pas encore finie : pas de double réclamation.
    assert_eq!(w.claim_season(2_000, end + 1), Err(WalletError::NotEligible));
    let mut b = Wallet { season_started_at: 0, ..Default::default() };
    assert_eq!(b.claim_season(0, economy::season_duration_ms()), Ok((50, 0))); // bronze
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
