/** Map of lane index → i18n key prefix for the identity. */
export const IDENTITY_KEYS = ["lanes.identity.force", "lanes.identity.wisdom", "lanes.identity.cunning"];

/** Move list used in the Help modal — gradient colours mirror MOVE_PALETTE. */
export const RPSLS_MOVES_HELP: { id: "rock" | "paper" | "scissors" | "lizard" | "spock"; glyph: string; color: string }[] = [
  { id: "rock",     glyph: "🪨", color: "from-stone-300 to-amber-400"   },
  { id: "paper",    glyph: "📄", color: "from-zinc-100 to-sky-200"      },
  { id: "scissors", glyph: "✂️", color: "from-rose-300 to-orange-400"   },
  { id: "lizard",   glyph: "🦎", color: "from-lime-300 to-emerald-500"  },
  { id: "spock",    glyph: "🖖", color: "from-cyan-300 to-violet-500"   },
];

export const COMBO_LEXICON: { id: string; glyph: string }[] = [
  { id: "rockslide",      glyph: "🪨" },
  { id: "origami",        glyph: "📄" },
  { id: "shear",          glyph: "✂️" },
  { id: "reptile",        glyph: "🦎" },
  { id: "vulcan",         glyph: "🖖" },
  { id: "trinityClassic", glyph: "🌀" },
  { id: "trinityQuantum", glyph: "🧠" },
  { id: "mirror",         glyph: "🪞" },
  { id: "sweep",          glyph: "👑" },
  { id: "wipeout",        glyph: "💀" },
  { id: "stalemate",      glyph: "🤝" },
];
