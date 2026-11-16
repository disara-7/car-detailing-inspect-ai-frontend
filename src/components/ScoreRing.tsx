import { LABEL_INFO } from "@/lib/format";
import type { OverallLabel } from "@/lib/schema";

interface ScoreRingProps {
  score: number;
  label: OverallLabel;
  size?: number;
}

export function ScoreRing({ score, label, size = 176 }: ScoreRingProps) {
  const info = LABEL_INFO[label];
  const clamped = Math.min(100, Math.max(0, score));
  const stroke = 14;
  const r = (100 - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={`Detailing need: ${clamped} out of 100. ${info.title}: ${info.description}.`}
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className={`${info.strokeClass} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
        <text
          x="50"
          y="49"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-fg text-[26px] font-bold tabular-nums"
        >
          {clamped}
        </text>
        <text x="50" y="68" textAnchor="middle" className="fill-fg-muted text-[8px]">
          out of 100
        </text>
      </svg>
      <div className="text-center" aria-hidden="true">
        <p className={`text-2xl font-bold ${info.textClass}`}>{info.title}</p>
        <p className="text-fg-muted">{info.description}</p>
      </div>
    </div>
  );
}
