import { cn } from '@/lib/utils';

export type Tone = 'on' | 'off' | 'alert' | 'bad' | 'neutral';

// State badge; colour only ever means state: on = ok, alert = needs a look,
// bad = alarm, neutral = informational, off = idle.
export function Pill({ text, tone }: { text: string; tone: Tone }) {
  const cls = { on: 'ok', off: '', alert: 'warn', bad: 'bad', neutral: 'info' }[tone];
  return <span className={cn('state', cls)}>{text}</span>;
}
