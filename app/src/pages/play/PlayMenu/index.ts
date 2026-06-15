/**
 * PlayMenu — écrans du hub de jeu (menu principal + lobbies).
 *
 * Découpé par responsabilité ; ce barrel ré-exporte les 4 écrans publics pour
 * que le chemin `./play/PlayMenu` reste identique pour `PlayPage`. Les composants
 * internes (ModeConfirmModal, DailyChallengesPanel) + les coutures partagées
 * (menuShared, sandboxShared) restent privés au dossier.
 */

export { ModeSelect } from "./ModeSelect";
export { SandboxView } from "./SandboxView";
export { ConstellationLobby } from "./ConstellationLobby";
export { ClasseLobby } from "./ClasseLobby";
