"use client";

import {
  cascadeSteps,
  provenanceLabel,
  type StressResult,
} from "@/lib/stress";

const LEVEL_FILL: Record<string, string> = {
  none: "#2c6aa8",
  constrained: "#b45309",
  major: "#b42318",
  critical: "#7f1d1d",
};

export function CascadeView({ result }: { result: StressResult }) {
  const steps = cascadeSteps(result);
  if (steps.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        No cascade path in this modeled scenario.
      </p>
    );
  }

  const width = Math.max(280, steps.length * 108);
  const height = 150;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Modeled cascade path"
        className="h-[150px] w-full min-w-[280px]"
      >
        {steps.map((step, index) => {
          const x = 54 + index * 108;
          const y = 48;
          const fill = LEVEL_FILL[step.level ?? "none"] ?? "#1e4f86";
          const prevX = 54 + (index - 1) * 108;
          return (
            <g key={`${step.id}-${index}`}>
              {index > 0 ? (
                <line
                  x1={prevX + 28}
                  y1={y}
                  x2={x - 28}
                  y2={y}
                  stroke="#d3deea"
                  strokeWidth="3"
                />
              ) : null}
              <circle cx={x} cy={y} r="26" fill={fill} />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="600"
              >
                {index + 1}
              </text>
              <text
                x={x}
                y={y + 46}
                textAnchor="middle"
                fill="#10233d"
                fontSize="11"
                fontWeight="600"
              >
                {truncate(step.label, 14)}
              </text>
              <text
                x={x}
                y={y + 62}
                textAnchor="middle"
                fill="#5a6d82"
                fontSize="9"
              >
                {provenanceLabel(step.source)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
