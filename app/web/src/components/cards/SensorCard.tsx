import {
  Thermometer, Droplet, DoorOpen, DoorClosed, Radar, ShieldCheck, HelpCircle,
  UserCheck, UserX, Droplets, Flame, Wind, CloudFog, Leaf, Sun,
} from 'lucide-react';
import type { Device } from '@/types/homekit';
import { isWaiting } from '@/types/homekit';
import { num } from '@/lib/format';
import { useI18n, type I18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { CardShell, type CardTone, type IconType } from './CardShell';

interface Rendered {
  icon: IconType;
  tone: CardTone;
  value: React.ReactNode;
}

function render(device: Device, i: I18n): Rendered {
  const { t, temp, pct, num: n } = i;
  const s = device.state;
  switch (device.kind) {
    case 'temperature':
      return {
        icon: Thermometer,
        tone: 'accent',
        value: <span className="val">{temp(s.temperature)}</span>,
      };
    case 'humidity':
      return {
        icon: Droplet,
        tone: 'accent',
        value: <span className="val">{pct(s.humidity)}</span>,
      };
    case 'temperature_humidity':
      return {
        icon: Thermometer,
        tone: 'accent',
        value: (
          <div className="flex flex-col items-end gap-0.5">
            <span className="val">{temp(s.temperature)}</span>
            <span className="val-2">
              <Droplet className="size-3.5" /> {pct(s.humidity)}
            </span>
          </div>
        ),
      };
    case 'contact': {
      const open = s.contact === 'open';
      return {
        icon: open ? DoorOpen : DoorClosed,
        tone: open ? 'warn' : 'idle',
        value: <Pill text={open ? t('open') : t('closed')} tone={open ? 'alert' : 'off'} />,
      };
    }
    case 'motion': {
      const detected = s.motion === 'detected';
      return {
        icon: detected ? Radar : ShieldCheck,
        tone: detected ? 'warn' : 'idle',
        value: <Pill text={detected ? t('detected') : t('clear')} tone={detected ? 'alert' : 'off'} />,
      };
    }
    case 'occupancy': {
      const occupied = s.occupancy === 'occupied';
      return {
        icon: occupied ? UserCheck : UserX,
        tone: occupied ? 'warn' : 'idle',
        value: <Pill text={occupied ? t('occupied') : t('vacant')} tone={occupied ? 'alert' : 'off'} />,
      };
    }
    case 'leak': {
      const leak = s.leak === 'leak';
      return {
        icon: Droplets,
        tone: leak ? 'bad' : 'idle',
        value: <Pill text={leak ? t('leak') : t('dry')} tone={leak ? 'bad' : 'off'} />,
      };
    }
    case 'smoke': {
      const smoke = s.smoke === 'smoke';
      return {
        icon: Flame,
        tone: smoke ? 'bad' : 'idle',
        value: <Pill text={smoke ? t('smoke') : t('noSmoke')} tone={smoke ? 'bad' : 'off'} />,
      };
    }
    case 'co':
    case 'co2': {
      const detected = s[device.kind] === 'detected';
      const level = num(s.level);
      return {
        icon: device.kind === 'co' ? Wind : CloudFog,
        tone: detected ? 'bad' : 'idle',
        value: (
          <div className="flex items-center gap-2">
            {level !== undefined && (
              <span className="val-2">
                {n(Math.round(level))} {device.kind === 'co2' ? 'ppm' : ''}
              </span>
            )}
            <Pill text={detected ? t('gasDetected') : t('ok')} tone={detected ? 'bad' : 'off'} />
          </div>
        ),
      };
    }
    case 'air_quality': {
      const q = num(s.quality) ?? 0;
      const tone = q >= 4 ? 'alert' : q >= 1 && q <= 2 ? 'on' : 'neutral';
      const pm25 = num(s.pm25);
      return {
        icon: Leaf,
        tone: q >= 4 ? 'warn' : q >= 1 && q <= 2 ? 'ok' : 'accent',
        value: (
          <div className="flex items-center gap-2">
            {pm25 !== undefined && (
              <span className="val-2">{n(pm25)} µg/m³</span>
            )}
            <Pill text={t(`aq.${Math.min(Math.max(q, 0), 5)}` as 'aq.0')} tone={tone} />
          </div>
        ),
      };
    }
    case 'light': {
      const lux = num(s.lux);
      return {
        icon: Sun,
        tone: 'accent',
        value: (
          <span className="val">
            {lux === undefined ? '—' : `${n(lux, lux < 10 ? 1 : 0)} lx`}
          </span>
        ),
      };
    }
    default:
      return {
        icon: HelpCircle,
        tone: 'idle',
        value: <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{num(s.value) !== undefined ? n(num(s.value)!, 1) : t('unknown')}</span>,
      };
  }
}

// Read-only card for sensor kinds (temperature, humidity, contact, motion).
export function SensorCard({ device }: { device: Device }) {
  const i18n = useI18n();
  const { icon, tone, value } = render(device, i18n);
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
      tone={tone}
      active={active}
      right={isWaiting(device)
        ? <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{i18n.t('waiting.short')}</span>
        : value}
    />
  );
}
