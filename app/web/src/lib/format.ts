export function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
