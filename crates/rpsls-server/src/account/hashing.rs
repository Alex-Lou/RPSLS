//! Hachage Argon2id (sel aléatoire CSPRNG) + anti-énumération par timing.

use std::sync::OnceLock;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::RngCore;

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
