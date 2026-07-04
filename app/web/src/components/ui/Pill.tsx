import { cn } from '@/lib/utils';

// A coloured pill used for boolean / enum states.
export function Pill({ text, tone }: { text: string; tone: 'on' | 'off' | 'alert' | 'neutral' }) {
  const cls = {
    on: 'bg-green-500/15 text-green-500',
    off: 'bg-muted text-muted-foreground',
    alert: 'bg-amber-500/15 text-amber-500',
    neutral: 'bg-blue-500/15 text-blue-500',
  }[tone];
  return (
    <span className={cn('text-sm font-semibold px-2.5 py-1 rounded-full', cls)}>{text}</span>
  );
}
