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

use super::{Wallet, WalletError};
use crate::player_state;

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

/// Crée le portefeuille au premier `WalletInit` (migration : reprise de la
/// ligne `player:{pid}`), ou renvoie l'existant. Idempotent.
pub async fn init(pid: &str) -> Result<Wallet, StoreError> {
    locked(pid, || async {
        if let Some(w) = load(pid).await? {
            return Ok(w);
        }
        let progress = player_state::load(pid)
            .await
            .map_err(|_| StoreError::Backend)?
            .unwrap_or_default();
        let w = Wallet::from_progress(&progress, now_ms());
        save(pid, &w).await?;
        Ok(w)
    })
    .await
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
