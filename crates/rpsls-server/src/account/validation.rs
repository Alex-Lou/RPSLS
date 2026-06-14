//! Validation / normalisation des e-mails et mots de passe (fonctions pures).

/// Normalise un e-mail (trim + lowercase) et le valide structurellement.
/// Renvoie None si la forme est invalide. On NE fait PAS le RFC 5322 complet —
/// juste assez pour rejeter le junk ET borner la clé Redis : charset ASCII
/// restreint, un seul `@`, partie locale + domaine non vides, un point dans le
/// domaine. Le charset borné ferme aussi tout vecteur d'injection dans la clé.
pub fn normalize_email(raw: &str) -> Option<String> {
    let e = raw.trim().to_lowercase();
    if e.len() < 3 || e.len() > 254 {
        return None;
    }
    // Charset volontairement étroit : couvre la quasi-totalité des e-mails réels
    // (ASCII) et exclut espaces, contrôles, `/`, etc.
    let charset_ok = e
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '@' | '.' | '_' | '+' | '-'));
    if !charset_ok {
        return None;
    }
    let parts: Vec<&str> = e.split('@').collect();
    if parts.len() != 2 {
        return None;
    }
    let (local, domain) = (parts[0], parts[1]);
    if local.is_empty() || domain.is_empty() {
        return None;
    }
    if !domain.contains('.') || domain.starts_with('.') || domain.ends_with('.') {
        return None;
    }
    Some(e)
}

/// Politique mot de passe : 8..=256 caractères. La longueur est le meilleur
/// prédicteur de robustesse ; on n'impose pas de règle de complexité (friction
/// inutile). Le plafond borne le coût Argon2 d'une entrée hostile.
pub fn validate_password(pw: &str) -> Result<(), ()> {
    let len = pw.chars().count();
    if (8..=256).contains(&len) {
        Ok(())
    } else {
        Err(())
    }
}

/// Domaines e-mail jetables connus. Refusés à l'inscription pour brider le farm
/// du bonus de bienvenue via des boîtes éphémères. Liste courte et conservatrice
/// (faux positifs quasi nuls) ; à étendre au besoin. Ce n'est PAS une frontière
/// de sécurité — juste un coût supplémentaire pour l'abuseur.
const DISPOSABLE_DOMAINS: &[&str] = &[
    "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com",
    "tempmail.com", "temp-mail.org", "throwawaymail.com", "yopmail.com", "getnada.com",
    "trashmail.com", "sharklasers.com", "maildrop.cc", "dispostable.com", "fakeinbox.com",
    "mintemail.com", "mohmal.com", "spam4.me", "emailondeck.com", "moakt.com",
];

/// True si l'e-mail NORMALISÉ appartient à un domaine jetable connu.
pub fn is_disposable_email(email_norm: &str) -> bool {
    match email_norm.rsplit('@').next() {
        Some(domain) => DISPOSABLE_DOMAINS.iter().any(|d| *d == domain),
        None => false,
    }
}

/// Forme CANONIQUE d'un e-mail pour la clé « bonus déjà reçu » : on retire le
/// sous-adressage `+tag` de la partie locale (et les points pour Gmail, qui les
/// ignore). `moi+1@gmail.com`, `moi.2+x@gmail.com` et `moi@gmail.com` partagent
/// donc UNE seule clé de bienvenue → un bonus par vraie boîte, même en
/// fabriquant des variantes. N'affecte PAS l'identité du compte
/// (`account:{email}` garde l'e-mail complet tel que saisi).
pub fn canonical_email(email_norm: &str) -> String {
    let mut parts = email_norm.splitn(2, '@');
    let local_raw = parts.next().unwrap_or("");
    let domain_raw = parts.next().unwrap_or("");
    // googlemail.com is an official alias of gmail.com — same physical inbox —
    // so fold it onto gmail.com BEFORE keying, else the same mailbox claims the
    // bonus twice (name@gmail.com vs name@googlemail.com).
    let domain = if domain_raw == "googlemail.com" { "gmail.com" } else { domain_raw };
    let mut local = local_raw.split('+').next().unwrap_or(local_raw).to_string();
    if domain == "gmail.com" {
        local = local.replace('.', "");
    }
    format!("{local}@{domain}")
}
