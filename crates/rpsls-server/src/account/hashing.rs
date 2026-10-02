//! Hachage Argon2id (sel aléatoire CSPRNG) + anti-énumération par timing.

use std::sync::OnceLock;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::RngCore;
use tokio::sync::Semaphore;

/// Argon2 coûte ~19 MiB + du CPU par appel. Plafond GLOBAL d'appels simultanés
/// (instance Render free : 512 Mo, CPU partagé) : au-delà, les demandes attendent
/// leur tour au lieu de saturer la RAM ou d'affamer les workers async.
const ARGON2_MAX_CONCURRENT: usize = 2;
static ARGON2_SLOTS: Semaphore = Semaphore::const_new(ARGON2_MAX_CONCURRENT);

/// Exécute un calcul Argon2 hors des workers async (`spawn_blocking`), sous le
/// sémaphore global. Err si la tâche bloquante a paniqué.
async fn run_argon2<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, ()> {
    let _permit = ARGON2_SLOTS.acquire().await.map_err(|_| ())?;
    tokio::task::spawn_blocking(f).await.map_err(|_| ())
}

/// Version async de [`hash_password`] (à utiliser depuis les handlers).
pub async fn hash_password_async(password: String) -> Result<String, ()> {
    run_argon2(move || hash_password(&password)).await?
}

/// Vérifie le mot de passe d'une connexion : contre le hash stocké si le compte
/// existe, sinon dépense un verify factice (anti-énumération par timing).
/// False en cas d'échec interne.
pub async fn verify_login(stored_hash: Option<String>, candidate: String) -> bool {
    run_argon2(move || match stored_hash {
        Some(h) => verify_password(&h, &candidate),
        None => {
            verify_dummy(&candidate);
            false
        }
    })
    .await
    .unwrap_or(false)
}

/// Hache un mot de passe en Argon2id (paramètres par défaut = recommandation
/// OWASP : m=19 MiB, t=2, p=1) avec un sel aléatoire de 16 octets tiré du CSPRNG
/// thread-local. Renvoie la chaîne PHC à stocker. Err sur échec interne (rare).
pub fn hash_password(password: &str) -> Result<String, ()> {
    let mut salt_bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt_bytes);
    let salt = SaltString::encode_b64(&salt_bytes).map_err(|_| ())?;
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| ())?;
    Ok(hash.to_string())
}

/// Vérifie un mot de passe candidat contre un hash PHC stocké. False si le hash
/// est illisible ou si la vérif échoue (jamais de panic sur entrée corrompue).
pub fn verify_password(stored_hash: &str, candidate: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(stored_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(candidate.as_bytes(), &parsed)
        .is_ok()
}

/// Hash factice (calculé une fois) pour égaliser le temps d'une connexion dont
/// l'e-mail N'EXISTE PAS : sans ça, un login « e-mail inconnu » répondrait bien
/// plus vite qu'un « mauvais mot de passe » → oracle de timing révélant quels
/// e-mails sont inscrits. On dépense un verify Argon2 dans les deux cas.
fn dummy_hash() -> &'static str {
    static H: OnceLock<String> = OnceLock::new();
    H.get_or_init(|| hash_password("argon2-anti-enumeration-dummy").unwrap_or_default())
}

/// Dépense un verify Argon2 ~équivalent à un vrai, sans révéler de résultat.
/// À appeler sur le chemin « e-mail introuvable » d'une connexion.
pub fn verify_dummy(candidate: &str) {
    let h = dummy_hash();
    if !h.is_empty() {
        let _ = verify_password(h, candidate);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    /// H5 : jamais plus de ARGON2_MAX_CONCURRENT calculs en même temps, même
    /// sous une rafale de connexions.
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn argon2_concurrency_is_capped() {
        let running = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let jobs: Vec<_> = (0..8)
            .map(|_| {
                let (running, peak) = (running.clone(), peak.clone());
                tokio::spawn(run_argon2(move || {
                    let now = running.fetch_add(1, Ordering::SeqCst) + 1;
                    peak.fetch_max(now, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(30));
                    running.fetch_sub(1, Ordering::SeqCst);
                }))
            })
            .collect();
        for j in jobs {
            j.await.unwrap().unwrap();
        }
        // `<=` et pas `==` : le sémaphore est global, un autre test peut tenir
        // un permis en parallèle. Sans plafond, le pic monterait à 8.
        let peak = peak.load(Ordering::SeqCst);
        assert!((1..=ARGON2_MAX_CONCURRENT).contains(&peak), "pic = {peak}");
    }

    #[tokio::test]
    async fn async_hash_then_login_roundtrips() {
        let h = hash_password_async("correct-horse-battery".into()).await.unwrap();
        assert!(verify_login(Some(h.clone()), "correct-horse-battery".into()).await);
        assert!(!verify_login(Some(h), "wrong-password".into()).await);
        assert!(!verify_login(None, "whatever".into()).await);
    }
}
