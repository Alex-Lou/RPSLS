//! Constellation Classée (CCG) — RELAIS AVEUGLE lockstep.
//!
//! Le serveur ne connaît PAS les règles CCG (cartes/mana/Voies) : elles vivent
//! en TypeScript côté client. Ce moteur se contente de :
//!   1. apparier deux joueurs (file `ccg_queue`),
//!   2. leur fournir une GRAINE PARTAGÉE (`shared_seed`) → les deux clients
//!      rejouent la MÊME partie déterministe (cf. `engine/rng.ts`),
//!   3. relayer les intentions de tour (3 coups + carte) VERBATIM entre eux —
//!      payload OPAQUE (`serde_json::Value`), jamais lu par le serveur,
//!   4. clôturer sur fin déclarée par le client / forfait / timeout.
//!
//! PAS de résolution serveur, PAS de LP (beta — décision Alex 2026-07 :
//! résultats client-authoritative, on ne crédite pas le classement).

use std::sync::Arc;
use std::time::Duration;

use rand::Rng;
use serde_json::Value;
use tokio::sync::mpsc;
use tokio::time::{timeout, Instant};
use uuid::Uuid;

use crate::protocol::{OpponentInfo, PlayerSlot, ServerMessage};
use crate::session::Session;

const PREP_DEADLINE: Duration = Duration::from_secs(30);
const COIN_REVEAL_PAUSE: Duration = Duration::from_millis(4000);
/// Large : un joueur réfléchit + anime le reveal entre deux tours.
const TURN_DEADLINE: Duration = Duration::from_secs(60);
const REMATCH_WINDOW: Duration = Duration::from_secs(30);

/// Commandes envoyées à un match CCG en cours.
#[derive(Debug)]
pub enum CcgCommand {
    /// Intention de tour d'un joueur (3 coups + carte) — payload OPAQUE relayé tel
    /// quel. `state_hash` = empreinte de l'état vu par ce client (anti-triche
    /// Phase 4) : le serveur compare les deux SANS lire le jeu.
    Turn {
        slot: PlayerSlot,
        round_no: u32,
        intent: Value,
        state_hash: String,
    },
    /// Fin déclarée par un client (sa résolution déterministe locale → vainqueur +
    /// hash du board final). Le serveur attend les DEUX déclarations et compare :
    /// accord → résultat ; désaccord → match droppé (anti-triche Phase 4).
    Result {
        slot: PlayerSlot,
        winner: Option<PlayerSlot>,
        state_hash: String,
    },
    Leave {
        slot: PlayerSlot,
    },
    Ready {
        slot: PlayerSlot,
    },
    RequestRematch {
        slot: PlayerSlot,
    },
    RespondRematch {
        slot: PlayerSlot,
        accept: bool,
    },
}

/// Spawn un match CCG. Retourne le sender pour lui pousser des commandes.
pub fn start_ccg_match(
    a: Arc<Session>,
    b: Arc<Session>,
    win_to: u8,
    on_end: Box<dyn FnOnce() + Send>,
) -> mpsc::UnboundedSender<CcgCommand> {
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        run_ccg_match(a, b, win_to, rx).await;
        on_end();
    });
    tx
}

async fn run_ccg_match(
    a: Arc<Session>,
    b: Arc<Session>,
    win_to: u8,
    mut rx: mpsc::UnboundedReceiver<CcgCommand>,
) {
    a.set_in_match(true);
    b.set_in_match(true);

    // Boucle externe : une passe par partie ; on rejoue sur rematch en réutilisant
    // CETTE task (le routage in_ccg reste valide).
    loop {
        let match_id = Uuid::new_v4().to_string();
        // Graine NEUVE à chaque partie/rematch → les deux boards resync identiques.
        let shared_seed: u64 = rand::thread_rng().gen();

        a.send(ServerMessage::CcgMatchFound {
            match_id: match_id.clone(),
            opponent: OpponentInfo { nickname: b.nickname() },
            you_are: PlayerSlot::A,
            win_to,
            shared_seed,
        });
        b.send(ServerMessage::CcgMatchFound {
            match_id: match_id.clone(),
            opponent: OpponentInfo { nickname: a.nickname() },
            you_are: PlayerSlot::B,
            win_to,
            shared_seed,
        });

        // Prep : double-ready + pièce serveur (identique au Lanes).
        if let PrepEnd::Aborted { winner } = ccg_prep(&a, &b, &mut rx).await {
            if let Some(w) = winner {
                session_for(other_slot(w), &a, &b).send(ServerMessage::OpponentLeft);
            }
            broadcast_end(&a, &b, winner, true, false);
            break;
        }

        // Boucle de relais des tours.
        match ccg_relay(&a, &b, &mut rx).await {
            RelayEnd::Result { winner } => {
                broadcast_end(&a, &b, winner, false, false);
                match ccg_rematch(&a, &b, &mut rx).await {
                    Rematch::Restart => continue,
                    Rematch::Done => break,
                }
            }
            RelayEnd::Forfeit { winner } => {
                if let Some(w) = winner {
                    session_for(w, &a, &b).send(ServerMessage::OpponentLeft);
                }
                broadcast_end(&a, &b, winner, true, false);
                break;
            }
            RelayEnd::Desync => {
                // Anti-triche : hash/résultat divergent → match ANNULÉ, aucun crédit.
                broadcast_end(&a, &b, None, false, true);
                break;
            }
            RelayEnd::Disconnect => break,
        }
    }

    a.set_in_match(false);
    b.set_in_match(false);
}

/* ──────────── Prep (double-ready + pièce) ──────────── */

enum PrepEnd {
    Ready,
    /// Prep échouée (leave/timeout). `winner` = le camp resté présent (None si
    /// les deux ont abandonné).
    Aborted { winner: Option<PlayerSlot> },
}

async fn ccg_prep(
    a: &Arc<Session>,
    b: &Arc<Session>,
    rx: &mut mpsc::UnboundedReceiver<CcgCommand>,
) -> PrepEnd {
    let mut ready_a = false;
    let mut ready_b = false;
    broadcast_ready_state(a, b, ready_a, ready_b);

    let deadline = Instant::now() + PREP_DEADLINE;
    loop {
        let now = Instant::now();
        if now >= deadline {
            return PrepEnd::Aborted { winner: present_slot(ready_a, ready_b) };
        }
        match timeout(deadline - now, rx.recv()).await {
            Err(_) => return PrepEnd::Aborted { winner: present_slot(ready_a, ready_b) },
            Ok(None) => return PrepEnd::Aborted { winner: None },
            Ok(Some(cmd)) => match cmd {
                CcgCommand::Ready { slot } => {
                    match slot {
                        PlayerSlot::A => ready_a = true,
                        PlayerSlot::B => ready_b = true,
                    }
                    broadcast_ready_state(a, b, ready_a, ready_b);
                    if ready_a && ready_b {
                        let coin_winner = if rand::thread_rng().gen_bool(0.5) {
                            PlayerSlot::A
                        } else {
                            PlayerSlot::B
                        };
                        let msg = ServerMessage::StartCoinFlip { winner: coin_winner };
                        a.send(msg.clone());
                        b.send(msg);
                        tokio::time::sleep(COIN_REVEAL_PAUSE).await;
                        return PrepEnd::Ready;
                    }
                }
                CcgCommand::Leave { slot } => {
                    return PrepEnd::Aborted { winner: Some(other_slot(slot)) };
                }
                _ => {}
            },
        }
    }
}

/* ──────────── Relais des tours ──────────── */

enum RelayEnd {
    /// Fin propre : les DEUX clients ont déclaré le MÊME vainqueur + hash final.
    Result { winner: Option<PlayerSlot> },
    /// Forfait (leave / timeout d'un côté). `winner` = camp resté.
    Forfeit { winner: Option<PlayerSlot> },
    /// DÉSYNCHRONISATION (anti-triche Phase 4) : hash d'état divergent en cours
    /// de partie OU déclarations de résultat incohérentes → match droppé, aucun crédit.
    Desync,
    /// Les deux côtés partis (canal fermé).
    Disconnect,
}

async fn ccg_relay(
    a: &Arc<Session>,
    b: &Arc<Session>,
    rx: &mut mpsc::UnboundedReceiver<CcgCommand>,
) -> RelayEnd {
    // Intentions en attente d'appariement (lockstep : un client n'envoie le tour
    // N+1 qu'après avoir résolu N, donc les deux tours en attente sont du même round).
    // On garde aussi le `state_hash` de chaque camp pour le comparer (anti-triche).
    let mut a_turn: Option<(u32, Value, String)> = None;
    let mut b_turn: Option<(u32, Value, String)> = None;
    // Résultats déclarés (winner + hash final) — on attend les DEUX pour comparer.
    let mut a_res: Option<(Option<PlayerSlot>, String)> = None;
    let mut b_res: Option<(Option<PlayerSlot>, String)> = None;

    loop {
        match timeout(TURN_DEADLINE, rx.recv()).await {
            Err(_) => {
                // Un côté a calé → il forfait ; les deux calés → nul.
                let winner = match (a_turn.is_some(), b_turn.is_some()) {
                    (true, false) => Some(PlayerSlot::A),
                    (false, true) => Some(PlayerSlot::B),
                    _ => None,
                };
                return RelayEnd::Forfeit { winner };
            }
            Ok(None) => return RelayEnd::Disconnect,
            Ok(Some(cmd)) => match cmd {
                CcgCommand::Turn { slot, round_no, intent, state_hash } => {
                    match slot {
                        PlayerSlot::A => a_turn = Some((round_no, intent, state_hash)),
                        PlayerSlot::B => b_turn = Some((round_no, intent, state_hash)),
                    }
                    if a_turn.is_some() && b_turn.is_some() {
                        let (a_round, a_intent, a_hash) = a_turn.take().unwrap();
                        let (b_round, b_intent, b_hash) = b_turn.take().unwrap();
                        // ANTI-TRICHE : les deux clients doivent voir le MÊME état à
                        // ce tour (hash égal). Divergence (hashes non vides ≠) =
                        // desync/triche → match droppé. (Vides = vieux client → skip.)
                        if !a_hash.is_empty() && !b_hash.is_empty() && a_hash != b_hash {
                            return RelayEnd::Desync;
                        }
                        // Chacun reçoit l'intention de l'AUTRE, verbatim.
                        a.send(ServerMessage::CcgTurnRelay {
                            from: PlayerSlot::B,
                            round_no: b_round,
                            intent: b_intent,
                        });
                        b.send(ServerMessage::CcgTurnRelay {
                            from: PlayerSlot::A,
                            round_no: a_round,
                            intent: a_intent,
                        });
                    }
                }
                CcgCommand::Result { slot, winner, state_hash } => {
                    match slot {
                        PlayerSlot::A => a_res = Some((winner, state_hash)),
                        PlayerSlot::B => b_res = Some((winner, state_hash)),
                    }
                    // On attend les DEUX déclarations, puis on compare (anti-triche).
                    if let (Some((aw, ah)), Some((bw, bh))) = (&a_res, &b_res) {
                        if aw == bw && ah == bh {
                            return RelayEnd::Result { winner: *aw };
                        }
                        return RelayEnd::Desync;
                    }
                }
                CcgCommand::Leave { slot } => {
                    return RelayEnd::Forfeit { winner: Some(other_slot(slot)) };
                }
                _ => {}
            },
        }
    }
}

/* ──────────── Rematch ──────────── */

enum Rematch {
    Restart,
    Done,
}

async fn ccg_rematch(
    a: &Arc<Session>,
    b: &Arc<Session>,
    rx: &mut mpsc::UnboundedReceiver<CcgCommand>,
) -> Rematch {
    let mut offered_by: Option<PlayerSlot> = None;
    loop {
        match timeout(REMATCH_WINDOW, rx.recv()).await {
            Err(_) | Ok(None) => return Rematch::Done,
            Ok(Some(cmd)) => match cmd {
                CcgCommand::RequestRematch { slot } => match offered_by {
                    None => {
                        offered_by = Some(slot);
                        session_for(other_slot(slot), a, b).send(ServerMessage::RematchOffered);
                    }
                    Some(prev) if prev != slot => return Rematch::Restart,
                    Some(_) => {}
                },
                CcgCommand::RespondRematch { slot, accept } => {
                    let asker = match offered_by {
                        Some(asker) if asker == other_slot(slot) => asker,
                        _ => continue,
                    };
                    if accept {
                        return Rematch::Restart;
                    }
                    session_for(asker, a, b).send(ServerMessage::RematchDeclined);
                    return Rematch::Done;
                }
                CcgCommand::Leave { slot } => {
                    if let Some(asker) = offered_by {
                        if asker != slot {
                            session_for(asker, a, b).send(ServerMessage::RematchDeclined);
                        }
                    }
                    return Rematch::Done;
                }
                _ => {}
            },
        }
    }
}

/* ──────────── Helpers ──────────── */

fn broadcast_ready_state(a: &Arc<Session>, b: &Arc<Session>, ready_a: bool, ready_b: bool) {
    a.send(ServerMessage::PrepReadyState { you_ready: ready_a, opp_ready: ready_b });
    b.send(ServerMessage::PrepReadyState { you_ready: ready_b, opp_ready: ready_a });
}

fn broadcast_end(a: &Arc<Session>, b: &Arc<Session>, winner: Option<PlayerSlot>, forfeit: bool, desync: bool) {
    let msg = ServerMessage::CcgMatchEnd { winner, forfeit, desync };
    a.send(msg.clone());
    b.send(msg);
    // Pas de leaderboard::record_result — beta sans LP (relais aveugle =
    // résultat client-authoritative). Sur desync=true, aucun crédit de toute façon.
}

/// Le camp encore présent d'après (ready_a, ready_b). None si les deux absents.
fn present_slot(ready_a: bool, ready_b: bool) -> Option<PlayerSlot> {
    match (ready_a, ready_b) {
        (true, false) => Some(PlayerSlot::A),
        (false, true) => Some(PlayerSlot::B),
        _ => None,
    }
}

fn session_for<'s>(slot: PlayerSlot, a: &'s Arc<Session>, b: &'s Arc<Session>) -> &'s Arc<Session> {
    match slot {
        PlayerSlot::A => a,
        PlayerSlot::B => b,
    }
}

fn other_slot(s: PlayerSlot) -> PlayerSlot {
    match s {
        PlayerSlot::A => PlayerSlot::B,
        PlayerSlot::B => PlayerSlot::A,
    }
}
