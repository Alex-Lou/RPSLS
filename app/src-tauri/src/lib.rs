use rand::seq::SliceRandom;
use rpsls_core::{resolve, Move, RoundResult};

#[tauri::command]
fn resolve_round(a: Move, b: Move) -> RoundResult {
    let outcome = resolve(a, b);
    RoundResult { move_a: a, move_b: b, outcome }
}

#[tauri::command]
fn random_move() -> Move {
    let mut rng = rand::thread_rng();
    *Move::ALL.choose(&mut rng).expect("ALL is non-empty")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_haptics::init())
        // tauri-plugin-store persists JSON files in the OS's data dir
        // (Android: /data/data/<pkg>/files/). The "player_anchor.json" key
        // survives the localStorage wipe that happens on uninstall in
        // Tauri Android. This is the durable home for player.id +
        // claimToken so the account isn't lost when the WebView storage
        // is purged.
        .plugin(tauri_plugin_store::Builder::default().build())
        // Native "Sign in with Google" — the ID token it returns is verified
        // server-side (google_auth.rs), so this is purely the token-acquisition.
        .plugin(tauri_plugin_google_auth::init())
        .invoke_handler(tauri::generate_handler![resolve_round, random_move])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
