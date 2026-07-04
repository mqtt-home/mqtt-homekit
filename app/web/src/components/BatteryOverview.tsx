import { BatteryCharging } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { num } from '@/lib/format';
import { BatteryIcon, batteryTone, LOW_BATTERY } from './BatteryBadge';
import { cn } from '@/lib/utils';

// Collapsible overview of every battery-powered device, lowest level first.
// The summary line always shows the weakest battery, so a dying device is
// visible without expanding.
export function BatteryOverview({ devices }: { devices: Device[] }) {
  const withBattery = devices
    .map(d => ({ device: d, level: num(d.state.battery) }))
    .filter((x): x is { device: Device; level: number } => x.level !== undefined)
    .sort((a, b) => a.level - b.level);

  if (withBattery.length === 0) return null;

  const lowest = withBattery[0];
  const lowCount = withBattery.filter(x => x.level <= LOW_BATTERY).length;

  return (
    <details className="mb-6 bg-card rounded-xl border border-border group">
      <summary className="flex items-center gap-3 p-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <BatteryCharging className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground">Batteries</span>
        <span className="text-xs text-muted-foreground">
          {withBattery.length} devices
          {lowCount > 0 && <span className="text-amber-500"> · {lowCount} low</span>}
        </span>
        <span className={cn('ml-auto text-sm font-medium tabular-nums flex items-center gap-1.5', batteryTone(lowest.level))}>
          <BatteryIcon level={lowest.level} className="h-4 w-4" />
          {lowest.device.name}: {Math.round(lowest.level)} %
        </span>
      </summary>
      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        {withBattery.map(({ device, level }) => (
          <div key={device.aid} className="flex items-center gap-2 text-sm">
            <BatteryIcon level={level} className="h-4 w-4 shrink-0" />
            <span className="text-foreground truncate flex-1">{device.name}</span>
            {device.room && <span className="text-xs text-muted-foreground truncate">{device.room}</span>}
            <span className={cn('font-medium tabular-nums', batteryTone(level))}>{Math.round(level)} %</span>
          </div>
        ))}
      </div>
    </details>
  );
}
