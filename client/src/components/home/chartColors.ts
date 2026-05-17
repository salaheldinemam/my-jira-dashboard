export const CHART_PALETTE = [
  "#38bdf8",
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#2dd4bf",
  "#f97316",
];

export function chartColor(index: number) {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
