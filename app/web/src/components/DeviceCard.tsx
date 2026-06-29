import type { ComponentType } from 'react';
import {
  Thermometer, Droplet, DoorOpen, DoorClosed, Radar, ShieldCheck,
  Power, Lightbulb, Blinds, ThermometerSun, HelpCircle,
} from 'lucide-react';
import type { Device } from '@/types/homekit';
import { isWaiting } from '@/types/homekit';
import { cn } from '@/lib/utils';

interface Props {
  device: Device;
}

type IconType = ComponentType<{ className?: string }>;

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
  thermostat: 'Thermostat',
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

function fmtTemp(v: unknown): string {
  const n = num(v);
  return n === undefined ? '—' : `${n.toFixed(1)} °C`;
}

function fmtPercent(v: unknown): string {
  const n = num(v);
  return n === undefined ? '—' : `${Math.round(n)} %`;
}

// A coloured pill used for boolean / enum states.
function Pill({ text, tone }: { text: string; tone: 'on' | 'off' | 'alert' | 'neutral' }) {
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

interface Rendered {
  icon: IconType;
  iconClass: string;
  value: React.ReactNode;
}

function render(device: Device): Rendered {
  const s = device.state;
  switch (device.kind) {
    case 'temperature':
      return {
        icon: Thermometer,
        iconClass: 'text-orange-500',
        value: <span className="text-2xl font-semibold tabular-nums">{fmtTemp(s.temperature)}</span>,
      };
    case 'humidity':
      return {
        icon: Droplet,
        iconClass: 'text-sky-500',
        value: <span className="text-2xl font-semibold tabular-nums">{fmtPercent(s.humidity)}</span>,
      };
    case 'temperature_humidity':
      return {
        icon: Thermometer,
        iconClass: 'text-orange-500',
        value: (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-2xl font-semibold tabular-nums">{fmtTemp(s.temperature)}</span>
            <span className="text-sm text-muted-foreground tabular-nums flex items-center gap-1">
              <Droplet className="h-3.5 w-3.5 text-sky-500" /> {fmtPercent(s.humidity)}
            </span>
          </div>
        ),
      };
    case 'contact': {
      const open = s.contact === 'open';
      return {
        icon: open ? DoorOpen : DoorClosed,
        iconClass: open ? 'text-amber-500' : 'text-muted-foreground',
        value: <Pill text={open ? 'Open' : 'Closed'} tone={open ? 'alert' : 'off'} />,
      };
    }
    case 'motion': {
      const detected = s.motion === 'detected';
      return {
        icon: detected ? Radar : ShieldCheck,
        iconClass: detected ? 'text-amber-500' : 'text-muted-foreground',
        value: <Pill text={detected ? 'Detected' : 'Clear'} tone={detected ? 'alert' : 'off'} />,
      };
    }
    case 'switch':
    case 'outlet': {
      const on = s.on === true;
      return {
        icon: Power,
        iconClass: on ? 'text-green-500' : 'text-muted-foreground',
        value: <Pill text={on ? 'On' : 'Off'} tone={on ? 'on' : 'off'} />,
      };
    }
    case 'lightbulb': {
      const on = s.on === true;
      const brightness = num(s.brightness);
      return {
        icon: Lightbulb,
        iconClass: on ? 'text-yellow-500' : 'text-muted-foreground',
        value: (
          <div className="flex items-center gap-2">
            {on && brightness !== undefined && (
              <span className="text-sm text-muted-foreground tabular-nums">{Math.round(brightness)} %</span>
            )}
            <Pill text={on ? 'On' : 'Off'} tone={on ? 'on' : 'off'} />
          </div>
        ),
      };
    }
    case 'window_covering': {
      const position = num(s.position);
      const tilt = num(s.tilt);
      return {
        icon: Blinds,
        iconClass: 'text-indigo-500',
        value: (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-2xl font-semibold tabular-nums">
              {position === undefined ? '—' : `${Math.round(position)} %`}
            </span>
            {tilt !== undefined && (
              <span className="text-sm text-muted-foreground tabular-nums">tilt {Math.round(tilt)}°</span>
            )}
          </div>
        ),
      };
    }
    case 'thermostat': {
      const current = num(s.current_temperature);
      const target = num(s.target_temperature);
      return {
        icon: ThermometerSun,
        iconClass: 'text-rose-500',
        value: (
          <span className="text-lg font-semibold tabular-nums">
            {current === undefined ? '—' : `${current.toFixed(1)}`}
            <span className="mx-1 text-muted-foreground">→</span>
            {target === undefined ? '—' : `${target.toFixed(1)}`}
            <span className="ml-1 text-sm text-muted-foreground">°C</span>
          </span>
        ),
      };
    }
    default:
      return {
        icon: HelpCircle,
        iconClass: 'text-muted-foreground',
        value: <span className="text-sm text-muted-foreground">Unknown</span>,
      };
  }
}

export function DeviceCard({ device }: Props) {
  const waiting = isWaiting(device);
  const { icon: Icon, iconClass, value } = render(device);

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
      <div className="h-12 w-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
        <Icon className={cn('h-6 w-6', iconClass)} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground truncate">{device.name}</h2>
        <p className="text-xs text-muted-foreground truncate">{kindLabel(device.kind)}</p>
      </div>
      <div className="shrink-0 text-right">
        {waiting ? (
          <span className="text-sm text-muted-foreground italic">waiting…</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
