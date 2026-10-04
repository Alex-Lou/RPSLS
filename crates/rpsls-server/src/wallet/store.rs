//! Persistance du portefeuille : clé Redis `wallet:{pid}`, écrite UNIQUEMENT ici.
//!
//! ATOMICITÉ : chaque opération lit → valide → écrit sous un verrou PAR JOUEUR
//! (mutex tokio, en mémoire). Deux requêtes concurrentes d'un même joueur (deux
//! onglets, double tap) sont donc sérialisées : pas de double dépense.
//! ⚠️ Hypothèse : UNE SEULE instance serveur (le cas sur Render aujourd'hui). Avec
//! plusieurs instances, il faudrait déplacer la transaction dans Redis (script
//! Lua / WATCH) : ce verrou ne protège qu'un processus.
//!
//! Le portefeuille n'existe que pour un joueur dont l'app gère l'éco serveur
//! (`WalletInit`). Tant qu'il n'existe pas, l'ancien flux (`SyncState`) reste
//! la source : une vieille version de l'app continue de fonctionner.

use std::sync::{Arc, OnceLock};

use dashmap::DashMap;
use tokio::sync::Mutex;
use tracing::warn;

use super::{Wallet, WalletError, WALLET_LAUNCH_MS};
use crate::player_state::{self, PlayerProgress};

const KEY_PREFIX: &str = "wallet:";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StoreError {
    /// Redis injoignable / réponse illisible : rien n'a été écrit.
    Backend,
    /// Pas de portefeuille pour ce joueur (l'app n'a pas envoyé `WalletInit`).
    NotInitialized,
    /// Refus métier (solde, déjà possédé…).
    Rule(WalletError),
}

impl StoreError {
    pub fn code(self) -> &'static str {
        match self {
            Self::Backend => "server_error",
            Self::NotInitialized => "wallet_not_initialized",
            Self::Rule(e) => e.code(),
        }
    }
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn locks() -> &'static DashMap<String, Arc<Mutex<()>>> {
    static LOCKS: OnceLock<DashMap<String, Arc<Mutex<()>>>> = OnceLock::new();
    LOCKS.get_or_init(DashMap::new)
}

/// Exécute `f` sous le verrou du joueur, puis libère l'entrée de la table si
/// plus personne ne l'attend (la table ne grossit pas avec le nombre de joueurs).
async fn locked<T, Fut: std::future::Future<Output = T>>(pid: &str, f: impl FnOnce() -> Fut) -> T {
    let lock = locks().entry(pid.to_string()).or_default().clone();
    let out = {
        let _guard = lock.lock().await;
        f().await
    };
    drop(lock);
    locks().remove_if(pid, |_, l| Arc::strong_count(l) == 1);
    out
}

async fn load(pid: &str) -> Result<Option<Wallet>, StoreError> {
    let raw = player_state::get_opt(&format!("{KEY_PREFIX}{pid}"))
        .await
        .map_err(|_| StoreError::Backend)?;
    match raw {
        None => Ok(None),
        Some(json) => serde_json::from_str(&json).map(Some).map_err(|e| {
            // Ligne illisible : ERREUR, jamais « absent » (sinon on la recréerait
            // par-dessus depuis la ligne player).
            warn!(player_id = %pid, error = %e, "wallet row unreadable");
            StoreError::Backend
        }),
    }
}

async fn save(pid: &str, w: &Wallet) -> Result<(), StoreError> {
    let json = serde_json::to_string(w).map_err(|_| StoreError::Backend)?;
    player_state::set_checked(&format!("{KEY_PREFIX}{pid}"), &json)
        .await
        .map_err(|_| StoreError::Backend)
}

/// Portefeuille existant, sans verrou (lecture seule : overlay des réponses
/// `StateLoaded` / `AuthOk`). `Ok(None)` = joueur encore sur l'ancien flux.
pub async fn get(pid: &str) -> Result<Option<Wallet>, StoreError> {
    load(pid).await
}

/// Crée le portefeuille au premier `WalletInit` (ou à l'activation forcée du
/// Hello), ou renvoie l'existant. Idempotent.
/// - identité ANTÉRIEURE au lancement (pas de `born:` ou `born` < `WALLET_LAUNCH_MS`)
///   avec une ligne player → migration BORNÉE de cette ligne ;
/// - sinon (identité neuve, ou aucune ligne) → portefeuille NEUF : cartes de
///   départ + bonus de bienvenue si le parcours compte l'a accordé
///   (`welcomed:{pid}`). La ligne player, écrite par le client, n'est pas lue.
pub async fn init(pid: &str) -> Result<Wallet, StoreError> {
    locked(pid, || async {
        if let Some(w) = load(pid).await? {
            return Ok(w);
        }
        let (born, progress, welcomed) = tokio::join!(
            player_state::born_ms(pid),
            player_state::load(pid),
            crate::account::is_welcomed(pid),
        );
        let born = born.map_err(|_| StoreError::Backend)?;
        let progress = progress.map_err(|_| StoreError::Backend)?;
        let welcomed = welcomed.map_err(|_| StoreError::Backend)?;
        let w = build_initial(born, progress.as_ref(), welcomed, now_ms());
        save(pid, &w).await?;
        Ok(w)
    })
    .await
}

/// Choix migration bornée / portefeuille neuf (PUR, testé).
pub(crate) fn build_initial(born: Option<u64>, row: Option<&PlayerProgress>, welcomed: bool, now: u64) -> Wallet {
    let legacy = born.map_or(true, |b| b < WALLET_LAUNCH_MS);
    match row {
        Some(p) if legacy => {
            let mut w = Wallet::from_progress(p, now);
            // Le bonus éventuel est déjà dans la ligne : pas de second don.
            w.welcomed = welcomed;
            w
        }
        _ => {
            let mut w = Wallet::fresh(now);
            if welcomed {
                w.apply_welcome(crate::account::WELCOME_CARDS);
            }
            w
        }
    }
}

/// Applique une opération à un portefeuille EXISTANT : lit, valide, écrit, sous
/// verrou. Rien n'est écrit si `op` refuse. Renvoie le résultat de `op` et le
/// portefeuille à jour (renvoyé tel quel au client).
pub async fn update<T>(
    pid: &str,
    op: impl FnOnce(&mut Wallet) -> Result<T, WalletError>,
) -> Result<(T, Wallet), StoreError> {
    locked(pid, || async {
        let mut w = load(pid).await?.ok_or(StoreError::NotInitialized)?;
        let out = op(&mut w).map_err(StoreError::Rule)?;
        save(pid, &w).await?;
        Ok((out, w))
    })
    .await
}
