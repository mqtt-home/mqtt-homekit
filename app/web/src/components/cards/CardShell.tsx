import type { ComponentType, ReactNode } from 'react';
import type { Device } from '@/types/homekit';
import { isWaiting } from '@/types/homekit';
import { BatteryBadge } from '@/components/BatteryBadge';
import { cn } from '@/lib/utils';

export type IconType = ComponentType<{ className?: string }>;

// Human-readable label for the accessory kind.
const KIND_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  temperature_humidity: 'Temperature & Humidity',
  contact: 'Contact Sensor',
  motion: 'Motion Sensor',
  switch: 'Switch',
  outlet: 'Outlet',
  lightbulb: 'Light',
  window_covering: 'Window Covering',
  blind: 'Window Covering',
  shade: 'Window Covering',
  thermostat: 'Thermostat',
  radiator: 'Thermostat',
  button: 'Button',
  occupancy: 'Occupancy Sensor',
  leak: 'Leak Sensor',
  smoke: 'Smoke Sensor',
  co: 'CO Sensor',
  co2: 'CO₂ Sensor',
  air_quality: 'Air Quality',
  light: 'Light Sensor',
  fan: 'Fan',
  lock: 'Lock',
  garage_door: 'Garage Door',
  door: 'Door',
  window: 'Window',
  valve: 'Valve',
  doorbell: 'Doorbell',
  security_system: 'Security System',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

interface Props {
  device: Device;
  icon: IconType;
  iconClass: string;
  // Right-hand slot: primary value or primary control.
  right: ReactNode;
  // Active state (door open, motion, switch on, cover open) renders the card
  // brighter so it stands out at a glance.
  active?: boolean;
  // Optional controls row rendered below a divider.
  children?: ReactNode;
}

// Common card frame: icon tile, name + kind, right-hand slot, optional
// controls section underneath.
export function CardShell({ device, icon: Icon, iconClass, right, active, children }: Props) {
  const waiting = isWaiting(device);
  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border p-4 transition-colors',
        active && 'bg-accent border-foreground/25',
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'h-12 w-12 shrink-0 rounded-lg flex items-center justify-center',
            active ? 'bg-foreground/10' : 'bg-muted',
          )}
        >
          <Icon className={cn('h-6 w-6', iconClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground truncate">{device.name}</h2>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            {kindLabel(device.kind)}
            {waiting && ' · waiting for data'}
            {typeof device.state.battery === 'number' && (
              <BatteryBadge level={device.state.battery} />
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">{right}</div>
      </div>
      {children && <div className="mt-4 pt-4 border-t border-border">{children}</div>}
    </div>
  );
}
