import {
  Thermometer, Droplet, DoorOpen, DoorClosed, Radar, ShieldCheck, HelpCircle,
  UserCheck, UserX, Droplets, Flame, Wind, CloudFog, Leaf, Sun,
} from 'lucide-react';
import type { Device } from '@/types/homekit';
import { isWaiting } from '@/types/homekit';
import { num, fmtTemp, fmtPercent } from '@/lib/format';
import { Pill } from '@/components/ui/Pill';
import { CardShell, type IconType } from './CardShell';

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
    case 'occupancy': {
      const occupied = s.occupancy === 'occupied';
      return {
        icon: occupied ? UserCheck : UserX,
        iconClass: occupied ? 'text-amber-500' : 'text-muted-foreground',
        value: <Pill text={occupied ? 'Occupied' : 'Vacant'} tone={occupied ? 'alert' : 'off'} />,
      };
    }
    case 'leak': {
      const leak = s.leak === 'leak';
      return {
        icon: Droplets,
        iconClass: leak ? 'text-red-500' : 'text-muted-foreground',
        value: <Pill text={leak ? 'Leak!' : 'Dry'} tone={leak ? 'alert' : 'off'} />,
      };
    }
    case 'smoke': {
      const smoke = s.smoke === 'smoke';
      return {
        icon: Flame,
        iconClass: smoke ? 'text-red-500' : 'text-muted-foreground',
        value: <Pill text={smoke ? 'Smoke!' : 'Clear'} tone={smoke ? 'alert' : 'off'} />,
      };
    }
    case 'co':
    case 'co2': {
      const detected = s[device.kind] === 'detected';
      const level = num(s.level);
      return {
        icon: device.kind === 'co' ? Wind : CloudFog,
        iconClass: detected ? 'text-red-500' : 'text-muted-foreground',
        value: (
          <div className="flex items-center gap-2">
            {level !== undefined && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {Math.round(level)} {device.kind === 'co2' ? 'ppm' : ''}
              </span>
            )}
            <Pill text={detected ? 'Detected!' : 'OK'} tone={detected ? 'alert' : 'off'} />
          </div>
        ),
      };
    }
    case 'air_quality': {
      const q = num(s.quality) ?? 0;
      const labels = ['Unknown', 'Excellent', 'Good', 'Fair', 'Inferior', 'Poor'];
      const tone = q >= 4 ? 'alert' : q >= 1 && q <= 2 ? 'on' : 'neutral';
      const pm25 = num(s.pm25);
      return {
        icon: Leaf,
        iconClass: q >= 4 ? 'text-amber-500' : 'text-green-500',
        value: (
          <div className="flex items-center gap-2">
            {pm25 !== undefined && (
              <span className="text-sm text-muted-foreground tabular-nums">{pm25.toFixed(0)} µg/m³</span>
            )}
            <Pill text={labels[Math.min(q, 5)]} tone={tone} />
          </div>
        ),
      };
    }
    case 'light': {
      const lux = num(s.lux);
      return {
        icon: Sun,
        iconClass: 'text-yellow-500',
        value: (
          <span className="text-2xl font-semibold tabular-nums">
            {lux === undefined ? '—' : `${lux < 10 ? lux.toFixed(1) : Math.round(lux)} lx`}
          </span>
        ),
      };
    }
    default:
      return {
        icon: HelpCircle,
        iconClass: 'text-muted-foreground',
        value: <span className="text-sm text-muted-foreground">{String(num(s.value) ?? 'Unknown')}</span>,
      };
  }
}

// Read-only card for sensor kinds (temperature, humidity, contact, motion).
export function SensorCard({ device }: { device: Device }) {
  const { icon, iconClass, value } = render(device);
  const active =
    (device.kind === 'contact' && device.state.contact === 'open') ||
    (device.kind === 'motion' && device.state.motion === 'detected') ||
    (device.kind === 'occupancy' && device.state.occupancy === 'occupied') ||
    (device.kind === 'leak' && device.state.leak === 'leak') ||
    (device.kind === 'smoke' && device.state.smoke === 'smoke') ||
    (device.kind === 'co' && device.state.co === 'detected') ||
    (device.kind === 'co2' && device.state.co2 === 'detected');
  return (
    <CardShell
      device={device}
      icon={icon}
      iconClass={iconClass}
      active={active}
      right={isWaiting(device)
        ? <span className="text-sm text-muted-foreground italic">waiting…</span>
        : value}
    />
  );
}
