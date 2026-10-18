import { BatteryLow, BatteryMedium, BatteryFull, BatteryWarning } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const LOW_BATTERY = 20;

// Colour only for a battery that needs attention.
export function batteryColor(level: number): string | undefined {
  if (level <= 10) return 'var(--alert)';
  if (level <= LOW_BATTERY) return 'var(--warn)';
  return undefined;
}

export function BatteryIcon({ level, className }: { level: number; className?: string }) {
  const Icon =
    level <= LOW_BATTERY ? BatteryWarning
    : level <= 40 ? BatteryLow
    : level <= 80 ? BatteryMedium
    : BatteryFull;
  return <Icon className={className} style={{ color: batteryColor(level) ?? 'var(--ink-3)' }} />;
}

// Compact inline battery indicator (icon + percent) used on device cards.
export function BatteryBadge({ level }: { level: number }) {
  const { pct } = useI18n();
  return (
    <span className={cn('num inline-flex shrink-0 items-center gap-0.5')} style={{ color: batteryColor(level) }}>
      <BatteryIcon level={level} className="size-3.5" />
      {pct(level)}
    </span>
  );
}
