export function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

export function fmtTemp(v: unknown): string {
  const n = num(v);
  return n === undefined ? '—' : `${n.toFixed(1)} °C`;
}

export function fmtPercent(v: unknown): string {
  const n = num(v);
  return n === undefined ? '—' : `${Math.round(n)} %`;
}
