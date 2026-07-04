import { BatteryLow, BatteryMedium, BatteryFull, BatteryWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LOW_BATTERY = 20;

export function batteryTone(level: number): string {
  if (level <= 10) return 'text-red-500';
  if (level <= LOW_BATTERY) return 'text-amber-500';
  return 'text-muted-foreground';
}

export function BatteryIcon({ level, className }: { level: number; className?: string }) {
  const Icon =
    level <= LOW_BATTERY ? BatteryWarning
    : level <= 40 ? BatteryLow
    : level <= 80 ? BatteryMedium
    : BatteryFull;
  return <Icon className={cn(className, batteryTone(level))} />;
}

// Compact inline battery indicator (icon + percent) used on device cards.
export function BatteryBadge({ level }: { level: number }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 tabular-nums', batteryTone(level))}>
      <BatteryIcon level={level} className="h-3.5 w-3.5" />
      {Math.round(level)} %
    </span>
  );
}
