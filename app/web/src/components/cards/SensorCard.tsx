import {
  Thermometer, Droplet, DoorOpen, DoorClosed, Radar, ShieldCheck, HelpCircle,
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
  return (
    <CardShell
      device={device}
      icon={icon}
      iconClass={iconClass}
      right={isWaiting(device)
        ? <span className="text-sm text-muted-foreground italic">waiting…</span>
        : value}
    />
  );
}
