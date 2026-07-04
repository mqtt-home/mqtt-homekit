import type { ComponentType, ReactNode } from 'react';
import type { Device } from '@/types/homekit';
import { isWaiting } from '@/types/homekit';
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
  // Optional controls row rendered below a divider.
  children?: ReactNode;
}

// Common card frame: icon tile, name + kind, right-hand slot, optional
// controls section underneath.
export function CardShell({ device, icon: Icon, iconClass, right, children }: Props) {
  const waiting = isWaiting(device);
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
          <Icon className={cn('h-6 w-6', iconClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground truncate">{device.name}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {kindLabel(device.kind)}
            {waiting && ' · waiting for data'}
          </p>
        </div>
        <div className="shrink-0 text-right">{right}</div>
      </div>
      {children && <div className="mt-4 pt-4 border-t border-border">{children}</div>}
    </div>
  );
}
