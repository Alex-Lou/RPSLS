/**
 * balance.tsx — point d'entrée du Voie Balance Lab (2e entrée Vite, sibling de
 * main.tsx). N'importe NI App, NI le store Zustand, NI bootSync, NI les shaders
 * → pas de splash WebGL, pas de gel preview. Juste les polices tech + le shell.
 */
import { createRoot } from "react-dom/client";

// Le moteur loggue via alog → console.log à chaque tour. En sim (des milliers de
// parties) ça inonde la console DevTools et fait s'effondrer le débit (~80s pour
// 4k parties). On neutralise log/info/debug sur cette page dédiée ; error/warn
// restent visibles, et on lit l'état du Lab via window.__voieLab__, pas la console.
const _noop = () => {};
console.log = _noop;
console.info = _noop;
console.debug = _noop;

// Polices cyberpunk (déjà bundlées par le jeu — voir theme/fonts.ts).
import "@fontsource/orbitron/600.css";
import "@fontsource/orbitron/900.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/share-tech-mono/400.css";
import "@fontsource/jetbrains-mono/400.css";

import "./balance.css";
import { BalanceLab } from "./BalanceLab";

createRoot(document.getElementById("lab-root")!).render(<BalanceLab />);
