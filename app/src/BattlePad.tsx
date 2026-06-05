import type { CSSProperties } from "react";
import type { PadId } from "./types";
import { useStore } from "./store/store";
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
import { CasinoPad } from "./battlepads/CasinoPad";

export function BattlePad({
  padId,
  className,
  style,
  compact = false,
}: {
  padId: PadId;
  className?: string;
  style?: CSSProperties;
  /** When true, pads suppress big animated centerpieces (e.g. the Cosmos
   *  atom orbits) so they read as quiet backdrops behind game content. */
  compact?: boolean;
}) {
  // The only image-based pad left is the player's own uploaded mat.
  const customPadUrl = useStore((s) => s.player.customPadUrl);

  const common = {
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
    case "casino":     return <CasinoPad {...common} compact={compact} />;
    case "custom":
      // Uploaded mat, or a graceful coded fallback until one is imported.
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
