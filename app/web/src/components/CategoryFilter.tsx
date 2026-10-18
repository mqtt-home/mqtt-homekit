import type { ComponentType } from 'react';
import { LayoutGrid, Gauge, Power, Plug, Lightbulb, Blinds, ThermometerSun, Shield } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useI18n, type Key } from '@/lib/i18n';

export type CategoryKey = 'all' | 'sensors' | 'switches' | 'outlets' | 'lights' | 'covers' | 'climate' | 'security';

interface Category {
  key: CategoryKey;
  icon: ComponentType<{ className?: string }>;
  kinds: string[]; // empty = matches everything
}

const CATEGORIES: Category[] = [
  { key: 'all', icon: LayoutGrid, kinds: [] },
  { key: 'sensors', icon: Gauge, kinds: ['temperature', 'humidity', 'temperature_humidity', 'contact', 'motion', 'occupancy', 'leak', 'smoke', 'co', 'co2', 'air_quality', 'light'] },
  { key: 'switches', icon: Power, kinds: ['switch', 'button', 'valve'] },
  // Outlets are their own category rather than part of Switches: HomeKit treats
  // them as a distinct service, and a socket is a different thing to reach for
  // than a rule toggle. The chip only appears when an outlet exists.
  { key: 'outlets', icon: Plug, kinds: ['outlet'] },
  { key: 'lights', icon: Lightbulb, kinds: ['lightbulb'] },
  { key: 'covers', icon: Blinds, kinds: ['window_covering', 'blind', 'shade', 'door', 'window', 'garage_door'] },
  { key: 'climate', icon: ThermometerSun, kinds: ['thermostat', 'radiator', 'fan'] },
  { key: 'security', icon: Shield, kinds: ['lock', 'security_system', 'doorbell'] },
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
  const { t } = useI18n();
  const visible = CATEGORIES.filter(
    c => c.key === 'all' || devices.some(d => c.kinds.includes(d.kind)),
  );
  if (visible.length <= 2) return null; // only one real category — no point filtering

  const count = (c: Category) =>
    c.key === 'all' ? devices.length : devices.filter(d => c.kinds.includes(d.kind)).length;

  return (
    <div className="chips" role="group" aria-label={t('filter')}>
      {visible.map(c => {
        const Icon = c.icon;
        return (
          <button
            key={c.key}
            type="button"
            className="chip"
            onClick={() => onChange(c.key)}
            aria-pressed={active === c.key}
          >
            <Icon />
            {t(`cat.${c.key}` as Key)}
            <span className="n">{count(c)}</span>
          </button>
        );
      })}
    </div>
  );
}
