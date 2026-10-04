import type { Move } from "../../engine/game";
import { rngInt } from "../../engine/rng";
import { drawN, HAND_CAP, CARDS, discardRandom } from "../cards";
import type { CardId, PlayedCard } from "../rankedTypes";
import { pickSacrifice, nextRarityUp, removeFirst } from "./rankedGameHelpers";
import { BASE_CPU_HAND_POOL } from "./rankedGameData";
import type { RankedGameCtx } from "./rankedGameContext";

/**
 * createCardActions — fabrique (appelée À CHAQUE rendu) des actions carte du
 * joueur : handlePlayCard (effets immédiats) et handleCancelCard (annulation).
 * Extrait VERBATIM de RankedGame.
 */
export function createCardActions(ctx: RankedGameCtx) {
  const {
    battle, cardPlayed, rng,
    setCardPlayed, setAugurRevealed, setAugurCooldown, setOracleRevealed, setCompassRevealed,
    cpuDecisionRef, pharePendingRef, cpuOneShotsRef, setBattle,
    setMascaradePoison, setBonusManaNext, bonusManaNextRoundRef, braiseActiveRef, setBraiseStacks,
    setOppHandRevealed, fardeauNextCpuRef, setCascadeArmed, anchorSnapshotRef, setAnchorRoundsLeft,
    anchorLossStreakRef, setEchoActive, manaMaxBoostRef, paradoxeUsedRef, genesisUsedRef,
    genesisPendingRef,
  } = ctx;

  function handlePlayCard(card: PlayedCard) {
    setCardPlayed(card);
    if (card.id === "augur") {
      setAugurRevealed({ lane: card.lane, move: card.revealed });
      setAugurCooldown(3); // Can't play Augur/Oracle for 2 more rounds (decremented at round start)
    } else if (card.id === "oracle") {
      // Oracle reveals all 3 — show via oracleRevealed or 3 augur states
      const r = card.revealed;
      setAugurRevealed(null); // Clear single augur, we use oracle state
      setOracleRevealed(r);
      setAugurCooldown(3);
    } else if (card.id === "telepathie") {
      // Télépathie — same reveal as Oracle but flavored "secret": no extra
      // UI hint, just the 3 picks revealed silently in oracle slots.
      const cpu = cpuDecisionRef.current;
      if (cpu) {
        const r: [Move, Move, Move] = [cpu.plays[0].mv, cpu.plays[1].mv, cpu.plays[2].mv];
        setOracleRevealed(r);
      }
    } else if (card.id === "mascarade") {
      // Bluff: poison the NEXT round's CPU read (disinformation lands later).
      setMascaradePoison(true);
    } else if (card.id === "boussole") {
      // Boussole (re-designed): reveal happens at the START OF NEXT ROUND so
      // the player can BOTH plan their picks AND play a counter card with the
      // same mana — the old in-round reveal was useless because the player
      // had already burned their card slot on Boussole itself. The chip +
      // compass peek visuals fire in startNextRound when this flag is set.
      pharePendingRef.current = true;
    }
    /* ─────────── V3 instant effects ─────────── */
    else if (card.id === "sablier") {
      // Sand-bender. Vs CPU the deadline is moot, so the card grants tempo:
      // +1 card NOW + +1 mana NEXT round — keeps the time-manipulation
      // theme by trading "saved seconds" for resource velocity.
      setBonusManaNext(bonusManaNextRoundRef.current + 1);
      setBattle((b) => {
        const dr = drawN(b.deck, b.hand, b.discard, 1, b.hand.length + 1, rng);
        return { ...b, deck: dr.deck, hand: dr.hand, discard: dr.discard };
      });
    }
    else if (card.id === "offre") {
      // Pure mana-bank — +2 next round in exchange for telegraphing your move
      // (the CPU doesn't use that info, so vs CPU the offer is generous).
      setBonusManaNext(bonusManaNextRoundRef.current + 2);
    }
    else if (card.id === "braise") {
      // Comeback charge: from now on, each round you LOSE shaves 1 mana off
      // your next card's cost (cumulative; min cost 1, reset when a card lands).
      braiseActiveRef.current = true;
      setBraiseStacks(0);
    }
    else if (card.id === "oracle-inverse") {
      // Reveal 3 random cards from the CPU's notional hand — shown as a chip
      // strip in the pick phase so the player can plan around them.
      const usedOneShots = new Set(cpuOneShotsRef.current);
      const pool = BASE_CPU_HAND_POOL.filter((id) => !usedOneShots.has(id));
      const picked: CardId[] = [];
      const work = pool.slice();
      for (let i = 0; i < 3 && work.length > 0; i++) {
        const idx = rngInt(rng, work.length);
        picked.push(work[idx]);
        work.splice(idx, 1);
      }
      setOppHandRevealed(picked);
    }
    else if (card.id === "fardeau") {
      // Stuff a weak card into the CPU's NEXT hand and force them to play it.
      // "second-wind" is a no-target, low-impact common — perfect as a poison.
      fardeauNextCpuRef.current = "second-wind";
    }
    else if (card.id === "cascade") {
      // All-in: WIN this round → refill hand to full for next round. LOSE →
      // empty hand. Decided at resolveAndAdvance — we just arm it here.
      setCascadeArmed(true);
    }
    else if (card.id === "ancre-temporelle") {
      // Snapshot the battle state RIGHT NOW (pre-resolve). Restored after
      // you lose 2 rounds in a row while the anchor watches; cleared if you
      // win any of them.
      anchorSnapshotRef.current = {
        winsA: battle.roundWinsA,
        winsB: battle.roundWinsB,
        hand: battle.hand.slice(),
        deck: battle.deck.slice(),
        discard: battle.discard.slice(),
        usedOneShotCards: battle.usedOneShotCards.slice(),
      };
      setAnchorRoundsLeft(2);
      anchorLossStreakRef.current = 0;
    }
    else if (card.id === "echo-temporel") {
      // Stop-loss: if THIS round ends in your loss, it's rewritten as a draw
      // and your card is refunded. The CPU's card still fires and burns.
      setEchoActive(true);
    }
    else if (card.id === "metamorphose") {
      // Sacrifice one card (auto: lowest rarity in hand) → draw a card of
      // one rarity higher. Legendary sacrifice draws TWO legendaries.
      setBattle((b) => {
        const sacrifice = pickSacrifice(b.hand, "metamorphose");
        if (!sacrifice) return b;
        const sacrificeRarity = CARDS[sacrifice].rarity;
        const targetRarity = nextRarityUp(sacrificeRarity);
        const drawCount = sacrificeRarity === "legendary" ? 2 : 1;
        // Burn the sacrifice (epics/legendaries to usedOneShotCards, else discard).
        let handAfter = removeFirst(b.hand, sacrifice);
        let discardAfter = b.discard;
        let usedAfter = b.usedOneShotCards;
        if (sacrificeRarity === "epic" || sacrificeRarity === "legendary") {
          usedAfter = [...usedAfter, sacrifice];
        } else {
          discardAfter = [...discardAfter, sacrifice];
        }
        // Pull from the deck — favor the target rarity, fall back to any card
        // if none in deck. Implemented as a filtered pull from the shuffled deck.
        let deckAfter = b.deck.slice();
        const drawn: CardId[] = [];
        for (let i = 0; i < drawCount; i++) {
          let idx = deckAfter.findIndex((id) => CARDS[id].rarity === targetRarity);
          if (idx === -1) idx = 0; // fallback to top of deck
          if (deckAfter.length === 0) break;
          drawn.push(deckAfter[idx]);
          deckAfter.splice(idx, 1);
        }
        return {
          ...b,
          deck: deckAfter,
          hand: [...handAfter, ...drawn],
          discard: discardAfter,
          usedOneShotCards: usedAfter,
        };
      });
    }
    else if (card.id === "marchand-ames") {
      // Faustian trade — discard 1 random card from hand (HP proxy), gain a
      // permanent +3 mana cap, and draw 3 cards.
      manaMaxBoostRef.current += 3;
      setBattle((b) => {
        let handAfter = b.hand.slice();
        let discardAfter = b.discard.slice();
        let usedAfter = b.usedOneShotCards.slice();
        if (handAfter.length > 0) {
          const dr = discardRandom(handAfter, discardAfter, usedAfter, rng);
          handAfter = dr.hand;
          discardAfter = dr.discard;
          usedAfter = dr.usedOneShotCards;
        }
        const draw = drawN(b.deck, handAfter, discardAfter, 3, HAND_CAP + 3, rng);
        return {
          ...b,
          deck: draw.deck,
          hand: draw.hand,
          discard: draw.discard,
          usedOneShotCards: usedAfter,
        };
      });
    }
    else if (card.id === "paradoxe") {
      // Time-skip: this round is voided. We mark it so resolveAndAdvance
      // refunds mana, returns the card to hand, and jumps to the next round.
      // Limit 1/match — guarded at handleSelectCard via a stub flag below.
      paradoxeUsedRef.current = true;
    }
    else if (card.id === "genese") {
      // Match reset. Take effect at the START of the next round so the
      // current round's resolution completes (the card still burns).
      genesisUsedRef.current = true;
      genesisPendingRef.current = true;
    }
    // riposte, vortex, supernova, second-wind, tide, precision, anchor, curse,
    // surge, aegis, heist, sangsue, rempart, trou-noir, trinite, prescience,
    // remanence (lane copy applied at resolve), echappee (lane wipe applied at
    // resolve), crepuscule (lane immunity in fx), benediction (bonus in fx),
    // schrodinger (best-of-two at resolve), juge (stat-based resolve) →
    // applied at resolve time, no immediate UI effect beyond the card badge.
  }
  function handleCancelCard() {
    if (cardPlayed?.id === "augur") setAugurRevealed(null);
    if (cardPlayed?.id === "oracle") setOracleRevealed(null);
    if (cardPlayed?.id === "telepathie") setOracleRevealed(null);
    if (cardPlayed?.id === "mascarade") setMascaradePoison(false);
    if (cardPlayed?.id === "boussole") {
      // Cancel the look-ahead arming AND any visual already on board.
      pharePendingRef.current = false;
      setCompassRevealed(null);
    }
    if (cardPlayed?.id === "oracle-inverse") setOppHandRevealed(null);
    if (cardPlayed?.id === "sablier") setBonusManaNext(Math.max(0, bonusManaNextRoundRef.current - 1));
    if (cardPlayed?.id === "offre") setBonusManaNext(Math.max(0, bonusManaNextRoundRef.current - 2));
    if (cardPlayed?.id === "braise") { braiseActiveRef.current = false; setBraiseStacks(0); }
    if (cardPlayed?.id === "fardeau") fardeauNextCpuRef.current = null;
    if (cardPlayed?.id === "cascade") setCascadeArmed(false);
    if (cardPlayed?.id === "ancre-temporelle") { anchorSnapshotRef.current = null; setAnchorRoundsLeft(0); }
    if (cardPlayed?.id === "echo-temporel") setEchoActive(false);
    if (cardPlayed?.id === "marchand-ames") manaMaxBoostRef.current = Math.max(0, manaMaxBoostRef.current - 3);
    if (cardPlayed?.id === "paradoxe") paradoxeUsedRef.current = false;
    if (cardPlayed?.id === "genese") { genesisUsedRef.current = false; genesisPendingRef.current = false; }
    setCardPlayed(null);
  }

  return { handlePlayCard, handleCancelCard };
}
