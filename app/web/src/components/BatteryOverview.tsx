import { BatteryCharging, ChevronDown } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { num } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { BatteryIcon, batteryColor, LOW_BATTERY } from './BatteryBadge';

// Collapsible overview of every battery-powered device, lowest level first.
// The summary line always shows the weakest battery, so a dying device is
// visible without expanding.
export function BatteryOverview({ devices }: { devices: Device[] }) {
  const { t, pct } = useI18n();
  const withBattery = devices
    .map(d => ({ device: d, level: num(d.state.battery) }))
    .filter((x): x is { device: Device; level: number } => x.level !== undefined)
    .sort((a, b) => a.level - b.level);

  if (withBattery.length === 0) return null;

  const lowest = withBattery[0];
  const lowCount = withBattery.filter(x => x.level <= LOW_BATTERY).length;

  return (
    <details className="card batt">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
        <span className="ico sm" style={{ ['--c' as string]: lowCount > 0 ? 'var(--warn)' : 'var(--idle)' }}>
          <BatteryCharging />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold">{t('batteries')}</div>
          <div className="text-xs" style={{ color: 'var(--ink-3)' }}>
            {t('batteries.count', { n: withBattery.length })}
            {lowCount > 0 && <span style={{ color: 'var(--warn)' }}> · {t('batteries.low', { n: lowCount })}</span>}
          </div>
        </div>
        <span className="num flex min-w-0 items-center gap-1.5 text-sm font-medium" style={{ color: batteryColor(lowest.level) }}>
          <BatteryIcon level={lowest.level} className="size-4 shrink-0" />
          <span className="truncate max-sm:hidden">{lowest.device.name}:</span>
          <span className="shrink-0">{pct(lowest.level)}</span>
        </span>
        <ChevronDown className="batt-chev size-4 shrink-0" style={{ color: 'var(--ink-4)' }} />
      </summary>
      <div className="grid grid-cols-1 gap-x-6 border-t px-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
        {withBattery.map(({ device, level }) => (
          <div key={device.aid} className="batt-row">
            <BatteryIcon level={level} className="size-4 shrink-0" />
            <span className="flex-1 truncate">{device.name}</span>
            {device.room && <span className="truncate text-xs" style={{ color: 'var(--ink-3)' }}>{device.room}</span>}
            <span className="num font-medium" style={{ color: batteryColor(level) }}>{pct(level)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
