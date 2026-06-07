import { type CSSProperties, useRef, useEffect, useCallback } from "react";
import type { PadId } from "./types";
import { useStore } from "./store/store";
import { usePageVisible } from "./usePageVisible";
import { W, H } from "./battlepads/dims";
import { ChalkboardPad } from "./battlepads/ChalkboardPad";
import { VintagePad } from "./battlepads/VintagePad";
import { NeonPad } from "./battlepads/NeonPad";
import { ComicsPad } from "./battlepads/ComicsPad";
import { CosmosPad } from "./battlepads/CosmosPad";
import { HolyPad } from "./battlepads/HolyPad";
import { QuantumPad } from "./battlepads/QuantumPad";
import { GalaxyPad } from "./battlepads/GalaxyPad";
import { CyberpunkPad } from "./battlepads/CyberpunkPad";
import { NebulaPad } from "./battlepads/NebulaPad";
import { AuroraBorealisPad } from "./battlepads/AuroraBorealisPad";
import { CasinoPad } from "./battlepads/CasinoPad";
import { CasinoNoirPad } from "./battlepads/CasinoNoirPad";
import { AuraPad } from "./battlepads/AuraPad";
import { VolcanicPad } from "./battlepads/VolcanicPad";
import { QuartzPad } from "./battlepads/QuartzPad";
import { AbyssPad } from "./battlepads/AbyssPad";
import { EclipsePad } from "./battlepads/EclipsePad";
import { PhantomPad } from "./battlepads/PhantomPad";
import { EmberforgePad } from "./battlepads/EmberforgePad";
import { TempusPad } from "./battlepads/TempusPad";
import { StormPad } from "./battlepads/StormPad";

export function BattlePad({
  padId,
  className,
  style,
  compact = false,
  frozen = false,
}: {
  padId: PadId;
  className?: string;
  style?: CSSProperties;
  compact?: boolean;
  /** Render a single still frame (SMIL paused on a settled frame). Used for
   *  thumbnails: a real, representative image of the pad with zero animation
   *  cost — the full animation only plays in the open preview. */
  frozen?: boolean;
}) {
  const customPadUrl = useStore((s) => s.player.customPadUrl);
  const visible = usePageVisible();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Jump to a settled frame (~2.6s in, past any intro fade) then freeze, so
  // the thumbnail shows the pad "in motion" rather than its blank t=0 state.
  const freeze = useCallback((el: SVGSVGElement) => {
    try { el.setCurrentTime(2.6); } catch { /* SMIL not ready — harmless */ }
    el.pauseAnimations();
  }, []);

  const setRef = useCallback((el: SVGSVGElement | null) => {
    svgRef.current = el;
    if (!el) return;
    if (frozen) freeze(el);
    else if (!visible) el.pauseAnimations();
  }, [visible, frozen, freeze]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    if (frozen) { freeze(el); return; }
    if (visible) el.unpauseAnimations();
    else el.pauseAnimations();
  }, [visible, frozen, freeze]);

  const common = {
    ref: setRef,
    className,
    style,
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "xMidYMid slice" as const,
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (padId) {
    case "chalkboard": return <ChalkboardPad {...common} />;
    case "vintage":    return <VintagePad {...common} />;
    case "cosmos":     return <CosmosPad {...common} compact={compact} />;
    case "galaxy":     return <GalaxyPad {...common} compact={compact} />;
    case "neon":       return <NeonPad {...common} compact={compact} />;
    case "holy":       return <HolyPad {...common} compact={compact} />;
    case "quantum":    return <QuantumPad {...common} compact={compact} />;
    case "cyberpunk":  return <CyberpunkPad {...common} compact={compact} />;
    case "comics":     return <ComicsPad {...common} />;
    case "nebula":     return <NebulaPad {...common} compact={compact} />;
    case "aurora_borealis": return <AuroraBorealisPad {...common} compact={compact} />;
    case "casino":     return <CasinoPad {...common} compact={compact} />;
    case "casino_noir":return <CasinoNoirPad {...common} compact={compact} />;
    case "aura":       return <AuraPad {...common} compact={compact} />;
    case "volcanic":   return <VolcanicPad {...common} compact={compact} />;
    case "abyss":      return <AbyssPad {...common} compact={compact} />;
    case "eclipse":    return <EclipsePad {...common} compact={compact} />;
    case "phantom":    return <PhantomPad {...common} compact={compact} />;
    case "emberforge": return <EmberforgePad {...common} compact={compact} />;
    case "tempus":     return <TempusPad {...common} compact={compact} />;
    case "storm":      return <StormPad {...common} compact={compact} />;
    case "quartz":     return <QuartzPad {...common} compact={compact} />;
    case "custom":
      return customPadUrl
        ? <ImagePad src={customPadUrl} {...common} />
        : <CosmosPad {...common} compact={compact} />;
    default:           return <ChalkboardPad {...common} />;
  }
}

/* ════════════════════ ImagePad ════════════════════
   Generic <image>-based playmat. Used for every PNG-driven pad in
   PAD_IMAGES so new image pads cost zero JSX once the file lands.
*/

function ImagePad({ src, ...rest }: { src: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...rest}>
      <image href={src} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}
