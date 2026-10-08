// Animated DNA double helix (pure SVG + CSS, no images).

export function DnaHelix({ rungs = 14, height = 320, className = '', speed = 2.6 }: { rungs?: number; height?: number; className?: string; speed?: number }) {
  const width = 120;
  const gap = height / rungs;
  const r = 38;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Rotating DNA double helix">
      <defs>
        <linearGradient id="gg-strand-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="gg-strand-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <style>{`
        @keyframes gg-swing { 0%,100% { transform: translateX(-${r}px) scale(.72); opacity:.55 } 50% { transform: translateX(${r}px) scale(1); opacity:1 } }
        @keyframes gg-rung { 0%,50%,100% { transform: scaleX(1) } 25%,75% { transform: scaleX(.04) } }
        .gg-dot { transform-box: fill-box; transform-origin: center; animation: gg-swing ${speed}s ease-in-out infinite; }
        .gg-line { transform-box: fill-box; transform-origin: center; animation: gg-rung ${speed}s ease-in-out infinite; }
      `}</style>
      {Array.from({ length: rungs }, (_, i) => {
        const y = gap / 2 + i * gap;
        const delay = -(i * speed) / 9;
        return (
          <g key={i}>
            <line
              className="gg-line"
              x1={width / 2 - r}
              x2={width / 2 + r}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={2.5}
              strokeLinecap="round"
              style={{ animationDelay: `${delay}s` }}
            />
            <circle className="gg-dot" cx={width / 2} cy={y} r={6} fill="url(#gg-strand-a)" style={{ animationDelay: `${delay}s` }} />
            <circle className="gg-dot" cx={width / 2} cy={y} r={6} fill="url(#gg-strand-b)" style={{ animationDelay: `${delay - speed / 2}s` }} />
          </g>
        );
      })}
    </svg>
  );
}
