//! I/O Redis du système de comptes (via les primitives centralisées de
//! `player_state` : `get_raw` / `set_nx` / `del`). Toutes les écritures de
//! réservation passent par `SET NX` → atomicité (ferme les courses de création
//! concurrente).

use super::AccountRecord;
use crate::player_state;

/// Clé Redis du compte, indexée par l'e-mail NORMALISÉ.
const ACCOUNT_PREFIX: &str = "account:";
/// Drapeau « ce player_id a déjà reçu le bonus » (SET NX) — rend le bonus
/// infarmable même si un même player_id crée plusieurs comptes. Volontairement
/// SÉPARÉ de `PlayerProgress` : un `SyncState` client ne doit jamais pouvoir le
/// remettre à zéro.
const WELCOMED_PREFIX: &str = "welcomed:";
/// Drapeau « cette BOÎTE e-mail a déjà reçu le bonus » (SET NX), keyé sur la
/// forme CANONIQUE de l'e-mail (cf. `canonical_email`). C'est lui qui rend le
/// bonus infarmable côté inscription e-mail : réinstaller (player_id neuf) ou
/// décliner des variantes `+tag` ne donne plus un nouveau bonus tant que la
/// vraie boîte est la même. Séparé de `welcomed:` (keyé player_id, voie Google).
const WELCOMED_EMAIL_PREFIX: &str = "welcomed_email:";
/// Index inverse player_id → e-mail du compte. Pose l'invariant « UN compte par
/// identité » : à l'inscription on le claim en SET NX ; s'il existe déjà, cette
/// identité a déjà un compte → on refuse (jamais deux comptes sur un player_id).
const ACCOUNT_PID_PREFIX: &str = "account_pid:";

/// Charge un compte par e-mail normalisé. None si absent / illisible.
pub async fn load_account(email_norm: &str) -> Option<AccountRecord> {
    let key = format!("{ACCOUNT_PREFIX}{email_norm}");
    let raw = player_state::get_raw(&key).await?;
    serde_json::from_str(&raw).ok()
}

/// Crée le compte de façon ATOMIQUE (`SET account:{email} NX`). Renvoie
/// Ok(true) si créé, Ok(false) si l'e-mail est déjà pris, Err sur panne backend.
/// L'atomicité ferme la course « deux inscriptions simultanées même e-mail ».
pub async fn try_create_account(record: &AccountRecord) -> Result<bool, ()> {
    let key = format!("{ACCOUNT_PREFIX}{}", record.email);
    let json = serde_json::to_string(record).map_err(|_| ())?;
    player_state::set_nx(&key, &json).await
}

/// Marque ATOMIQUEMENT un player_id comme « bonus reçu » (`SET welcomed:{id} NX`).
/// Ok(true) = première fois (don autorisé), Ok(false) = déjà reçu (refuser le
/// don), Err = panne (par sécurité l'appelant NE donne PAS le bonus).
pub async fn try_mark_welcomed(player_id: &str) -> Result<bool, ()> {
    let key = format!("{WELCOMED_PREFIX}{player_id}");
    player_state::set_nx(&key, "1").await
}

/// Marque ATOMIQUEMENT une BOÎTE e-mail (forme canonique) comme « bonus reçu »
/// (`SET welcomed_email:{canonical} NX`). Ok(true) = première fois pour cette
/// boîte (don autorisé), Ok(false) = déjà reçu (refuser), Err = panne (défaut
/// sûr : pas de don). C'est la garde anti-farm de l'inscription e-mail.
pub async fn try_mark_welcomed_email(canonical: &str) -> Result<bool, ()> {
    let key = format!("{WELCOMED_EMAIL_PREFIX}{canonical}");
    player_state::set_nx(&key, "1").await
}

/// Lie ATOMIQUEMENT un player_id à l'e-mail de SON compte (`SET account_pid:{id}
/// NX`). Ok(true) = lié (cette identité n'avait pas de compte), Ok(false) =
/// l'identité a DÉJÀ un compte (refuser : un seul compte par identité),
/// Err = panne backend.
pub async fn try_link_player(player_id: &str, email_norm: &str) -> Result<bool, ()> {
    let key = format!("{ACCOUNT_PID_PREFIX}{player_id}");
    player_state::set_nx(&key, email_norm).await
}

/// Annule (best-effort) le lien identité→compte posé par `try_link_player`,
/// quand l'étape de création de la ligne compte échoue ENSUITE. Garde l'identité
/// réutilisable pour une nouvelle tentative d'inscription.
pub(crate) async fn delete_account_link(player_id: &str) {
    let key = format!("{ACCOUNT_PID_PREFIX}{player_id}");
    player_state::del(&key).await;
}
