import type { ComponentType, ReactNode } from 'react';
import type { Device } from '@/types/homekit';
import { isWaiting } from '@/types/homekit';
import { BatteryBadge } from '@/components/BatteryBadge';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type IconType = ComponentType<{ className?: string }>;

// State colour of the icon chip (and of the card while active). Colour only
// means state: idle = off/inactive, accent = reporting a value, ok = on/safe,
// warn = open/detected, bad = alarm, light = a light that is on.
export type CardTone = 'idle' | 'accent' | 'ok' | 'warn' | 'bad' | 'info' | 'light';

// Localized label for the accessory kind.
export function useKindLabel() {
  const { tx } = useI18n();
  return (kind: string) => tx(`kind.${kind}`, kind);
}

interface Props {
  device: Device;
  icon: IconType;
  tone: CardTone;
  // Right-hand slot: primary value or primary control.
  right: ReactNode;
  // Active state (door open, motion, switch on, cover open) tints the card so
  // it stands out at a glance.
  active?: boolean;
  // Optional controls rendered below a divider.
  children?: ReactNode;
}

// Common card frame: icon chip, name + kind, right-hand slot, optional
// controls section underneath.
export function CardShell({ device, icon: Icon, tone, right, active, children }: Props) {
  const { t } = useI18n();
  const kindLabel = useKindLabel();
  const waiting = isWaiting(device);
  return (
    <div className={cn('card dev', `tone-${tone}`, active && 'active')}>
      <div className="flex items-center gap-3">
        <span className="ico">
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="name truncate">{device.name}</h3>
          <p className="sub">
            <span className="truncate">
              {kindLabel(device.kind)}
              {waiting && ` · ${t('waiting')}`}
            </span>
            {typeof device.state.battery === 'number' && <BatteryBadge level={device.state.battery} />}
          </p>
        </div>
        <div className="shrink-0 text-right">{right}</div>
      </div>
      {children && <div className="ctl">{children}</div>}
    </div>
  );
}
