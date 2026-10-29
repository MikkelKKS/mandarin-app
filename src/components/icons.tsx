/* Small inline icons (stroke-based, inherit currentColor). */
type P = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' };

export const Speaker = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
export const Turtle = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 15c0-4 3.5-7 8-7s8 3 8 7H4z" />
    <path d="M20 15h1.5a1.5 1.5 0 0 0 0-3H20M7 15l-1 3M17 15l1 3M9 8.5l1.5 6.5M15 8.5 13.5 15" />
  </svg>
);
export const Close = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const Check = ({ className }: P) => (
  <svg {...base} strokeWidth={3} className={className} aria-hidden>
    <path d="m5 12 5 5L20 7" />
  </svg>
);
export const Cog = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const Book = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </svg>
);
export const Headphones = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4zM3 19a2 2 0 0 0 2 2h1v-6H3v4z" />
  </svg>
);
export const Lightbulb = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
  </svg>
);
export const MicOff = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.6 6M12 18v3" />
  </svg>
);
export const Chart = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);
export const Music = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
/** The four tone contours: level, rising, dipping, falling. */
export const Waves = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M2 7h4M8 17l4-10M14 9q1.5 8 3 0M19 7l3 10" />
  </svg>
);
export const ChevronRight = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const ChevronLeft = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const Home = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5z" />
  </svg>
);
export const Library = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M5 4v16M9.5 4v16" />
    <path d="m14 5.2 3.8-1 3 14.6-3.8 1z" />
  </svg>
);
export const Search = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);
export const Flame = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5 3.4-8.4.2-.9 1.3-1.2 1.8-.4 2.4 3.4 6.8 5.3 6.8 8.8 0 3.2-2.4 5.6-6 5.6z" />
    <path d="M12 21c-1.6 0-2.6-1.1-2.6-2.5 0-1.6 1.4-2.6 2.6-4 1.2 1.4 2.6 2.4 2.6 4 0 1.4-1 2.5-2.6 2.5z" />
  </svg>
);
/** Reading: a character in a box. */
export const Glyph = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <path d="M8 9h8M12 6.5v11M8.5 13.5h7" />
  </svg>
);
