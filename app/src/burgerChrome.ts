/**
 * Mini-store « chrome propre » (burger masqué + ouverture externe du drawer)
 * — extrait verbatim de Sidebar.tsx, qui le réexporte.
 */
import { useSyncExternalStore } from "react";

/* ─────────── Chrome propre (Alex 2026-06-12, navigation unifiée) ───────────
 * Hors match, le burger vit dans la barre du haut (AppTopBar). Un écran qui
 * rend SA PROPRE chrome (menu principal : burger inline à gauche du Défi du
 * jour ; plateau Arena ; match Classé) pose setBurgerHidden(true) → ni barre
 * du haut ni burger flottant. Tous ouvrent le même drawer via openMobileMenu().
 * Pattern mini-store identique à matchExitStore (module scope +
 * useSyncExternalStore). */
let burgerHidden = false;
const burgerSubs = new Set<() => void>();
let externalOpenDrawer: (() => void) | null = null;
/** Enregistre (ou retire, avec null) l'ouverture du drawer — posé par MobileShell. */
export function setExternalOpenDrawer(fn: (() => void) | null): void {
  externalOpenDrawer = fn;
}
export function setBurgerHidden(h: boolean): void {
  if (h === burgerHidden) return;
  burgerHidden = h;
  burgerSubs.forEach((f) => f());
}
/** Ouvre le drawer mobile depuis un bouton externe (burger inline du menu). */
export function openMobileMenu(): void {
  externalOpenDrawer?.();
}
function subscribeBurgerHidden(cb: () => void): () => void {
  burgerSubs.add(cb);
  return () => { burgerSubs.delete(cb); };
}
function getBurgerHidden(): boolean {
  return burgerHidden;
}
/** Vrai quand l'écran courant rend SA PROPRE chrome (menu principal, plateau
 *  Arena, match Classé…) : ni barre du haut, ni burger flottant. */
export function useOwnChrome(): boolean {
  return useSyncExternalStore(subscribeBurgerHidden, getBurgerHidden, () => false);
}
