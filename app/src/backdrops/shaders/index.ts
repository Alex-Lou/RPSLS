/**
 * Composes the final GLSL FRAG string for ThemedBackdrop by concatenating
 * the modular pieces (common header → 20 scene functions → touch FX helper
 * → main()).
 *
 * Order matters: GLSL requires every callee to be declared above its caller
 * in the source. main() calls every scene + applyTouchFx, so they all come
 * first; each scene only uses common helpers (hash/noise/fbm/softStars/PI)
 * declared in COMMON_GLSL.
 *
 * Add a new scene in 3 steps:
 *   1. drop `myScene.glsl.ts` exporting `MY_SCENE_GLSL` next to its siblings;
 *   2. import it here and slot it into SCENES below;
 *   3. add the `u_scene == N` branch in main.glsl.ts and the SCENE_INDEX
 *      entry in ThemedBackdrop.tsx.
 */

import { COMMON_GLSL } from "./common.glsl";
import { NEBULA_GLSL } from "./scenes/nebula.glsl";
import { AURORA_GLSL } from "./scenes/aurora.glsl";
import { GRID_GLSL } from "./scenes/grid.glsl";
import { GALAXY_GLSL } from "./scenes/galaxy.glsl";
import { HOLY_GLSL } from "./scenes/holy.glsl";
import { QUANTUM_GLSL } from "./scenes/quantum.glsl";
import { CASINO_GLSL } from "./scenes/casino.glsl";
import { VOLCANIC_GLSL } from "./scenes/volcanic.glsl";
import { ECLIPSE_GLSL } from "./scenes/eclipse.glsl";
import { PHANTOM_GLSL } from "./scenes/phantom.glsl";
import { EMBERFORGE_GLSL } from "./scenes/emberforge.glsl";
import { TEMPUS_GLSL } from "./scenes/tempus.glsl";
import { STORM_GLSL } from "./scenes/storm.glsl";
import { ABYSS_GLSL } from "./scenes/abyss.glsl";
import { CORAL_GLSL } from "./scenes/coral.glsl";
import { RUST_GLSL } from "./scenes/rust.glsl";
import { VOID_SCENE_GLSL } from "./scenes/voidScene.glsl";
import { PRISM_GLSL } from "./scenes/prism.glsl";
import { INK_GLSL } from "./scenes/ink.glsl";
import { BLOOM_GLSL } from "./scenes/bloom.glsl";
import { TOUCH_FX_GLSL } from "./touchFx.glsl";
import { MAIN_GLSL } from "./main.glsl";

const SCENES = [
  NEBULA_GLSL, AURORA_GLSL, GRID_GLSL, GALAXY_GLSL, HOLY_GLSL, QUANTUM_GLSL,
  CASINO_GLSL, VOLCANIC_GLSL, ECLIPSE_GLSL, PHANTOM_GLSL, EMBERFORGE_GLSL,
  TEMPUS_GLSL, STORM_GLSL, ABYSS_GLSL, CORAL_GLSL, RUST_GLSL, VOID_SCENE_GLSL,
  PRISM_GLSL, INK_GLSL, BLOOM_GLSL,
];

export const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

export const FRAG = [
  COMMON_GLSL,
  ...SCENES,
  TOUCH_FX_GLSL,
  MAIN_GLSL,
].join("\n");
