import type { ComponentType } from 'react';
import { LayoutGrid, Gauge, Power, Lightbulb, Blinds, ThermometerSun } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { cn } from '@/lib/utils';

export type CategoryKey = 'all' | 'sensors' | 'switches' | 'lights' | 'covers' | 'thermostats';

interface Category {
  key: CategoryKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  kinds: string[]; // empty = matches everything
}

const CATEGORIES: Category[] = [
  { key: 'all', label: 'All', icon: LayoutGrid, kinds: [] },
  { key: 'sensors', label: 'Sensors', icon: Gauge, kinds: ['temperature', 'humidity', 'temperature_humidity', 'contact', 'motion'] },
  { key: 'switches', label: 'Switches', icon: Power, kinds: ['switch', 'outlet', 'button'] },
  { key: 'lights', label: 'Lights', icon: Lightbulb, kinds: ['lightbulb'] },
  { key: 'covers', label: 'Covers', icon: Blinds, kinds: ['window_covering', 'blind', 'shade'] },
  { key: 'thermostats', label: 'Thermostats', icon: ThermometerSun, kinds: ['thermostat', 'radiator'] },
];

export function matchesCategory(device: Device, key: CategoryKey): boolean {
  if (key === 'all') return true;
  const cat = CATEGORIES.find(c => c.key === key);
  return cat ? cat.kinds.includes(device.kind) : true;
}

interface Props {
  devices: Device[];
  active: CategoryKey;
  onChange: (key: CategoryKey) => void;
}

// Filter chips for the device categories; only categories that exist in the
// current accessory list are shown, with counts.
export function CategoryFilter({ devices, active, onChange }: Props) {
  const visible = CATEGORIES.filter(
    c => c.key === 'all' || devices.some(d => c.kinds.includes(d.kind)),
  );
  if (visible.length <= 2) return null; // only one real category — no point filtering

  const count = (c: Category) =>
    c.key === 'all' ? devices.length : devices.filter(d => c.kinds.includes(d.kind)).length;

  return (
    <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by device category">
      {visible.map(c => {
        const Icon = c.icon;
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {c.label}
            <span className={cn('text-xs tabular-nums', isActive ? 'opacity-80' : 'opacity-60')}>
              {count(c)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
