import type { ReactNode } from "react";

/**
 * VisuallyHidden — render content for screen readers only.
 *
 * Uses the WebAIM-recommended clip-rect technique that survives modern
 * browsers and is honoured by VoiceOver / TalkBack / NVDA. The element
 * still receives focus and is read aloud, just not painted to the screen.
 *
 * Use sparingly: only when an aria-label would lose context (e.g. when a
 * button shows only an icon and needs a paragraph of explanation).
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {children}
    </span>
  );
}
