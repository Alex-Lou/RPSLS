//! Faux Upstash REST, EN MÉMOIRE, partagé par tous les tests du binaire.
//!
//! La config Upstash est lue une seule fois (`OnceLock`) : tous les tests qui
//! touchent Redis doivent donc viser LE MÊME serveur. Il tourne sur un thread
//! dédié (son propre runtime), pour survivre à la fin de chaque `#[tokio::test]`.
//!
//! Routes : `GET /get/:key` et `POST /pipeline` (commandes GET / SET / SET NX).
//! Clés spéciales : `player:corrupt` → JSON illisible ; `player:upstash-down` →
//! HTTP 500.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use axum::{extract::Path, http::StatusCode, routing::{get, post}, Json, Router};
use serde_json::{json, Value};

fn store() -> &'static Mutex<HashMap<String, String>> {
    static S: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Écrit directement une valeur (préparation d'un test).
pub fn put(key: &str, val: &str) {
    store().lock().unwrap().insert(key.to_string(), val.to_string());
}

pub fn read(key: &str) -> Option<String> {
    store().lock().unwrap().get(key).cloned()
}

fn get_value(key: &str) -> Result<Value, StatusCode> {
    match key {
        "player:corrupt" => Ok(json!({ "result": "{not json" })),
        "player:upstash-down" => Err(StatusCode::INTERNAL_SERVER_ERROR),
        k => Ok(json!({ "result": read(k) })),
    }
}

async fn get_route(Path(key): Path<String>) -> Result<Json<Value>, StatusCode> {
    get_value(&key).map(Json)
}

async fn pipeline(Json(cmds): Json<Vec<Vec<String>>>) -> Result<Json<Value>, StatusCode> {
    let mut out = Vec::new();
    for c in cmds {
        let res = match c.iter().map(String::as_str).collect::<Vec<_>>().as_slice() {
            ["GET", k] => get_value(k)?,
            ["SET", k, v] => {
                put(k, v);
                json!({ "result": "OK" })
            }
            ["SET", k, v, "NX"] => {
                let mut s = store().lock().unwrap();
                if s.contains_key(*k) {
                    json!({ "result": null })
                } else {
                    s.insert(k.to_string(), v.to_string());
                    json!({ "result": "OK" })
                }
            }
            _ => return Err(StatusCode::BAD_REQUEST),
        };
        out.push(res);
    }
    Ok(Json(Value::Array(out)))
}

/// Démarre le faux serveur (une fois) et pointe la config Upstash dessus.
pub fn ensure() {
    static STARTED: OnceLock<()> = OnceLock::new();
    STARTED.get_or_init(|| {
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async move {
                let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
                tx.send(listener.local_addr().unwrap()).unwrap();
                let app = Router::new()
                    .route("/get/:key", get(get_route))
                    .route("/pipeline", post(pipeline));
                axum::serve(listener, app).await.unwrap();
            });
        });
        let addr = rx.recv().unwrap();
        std::env::set_var("UPSTASH_REDIS_REST_URL", format!("http://{addr}"));
        std::env::set_var("UPSTASH_REDIS_REST_TOKEN", "test-token");
    });
}
