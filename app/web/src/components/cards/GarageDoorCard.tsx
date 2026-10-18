import { TriangleAlert, Warehouse } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Garage door: open/close toggle with an obstruction warning.
export function GarageDoorCard({ device }: { device: Device }) {
  const { t } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const open = state.open === true || state.open === 'open';
  const obstructed = state.obstruction === 'obstructed';
  return (
    <CardShell
      device={device}
      icon={Warehouse}
      tone={obstructed ? 'bad' : open ? 'warn' : 'idle'}
      active={open || obstructed}
      right={
        <div className="flex items-center gap-2">
          {obstructed && (
            <TriangleAlert className="size-5" style={{ color: 'var(--alert)' }} aria-label={t('obstructed')} />
          )}
          <Pill text={open ? t('open') : t('closed')} tone={open ? 'alert' : 'off'} />
          {can('open') && (
            <Toggle checked={open} onChange={v => set('open', v)} aria-label={`${device.name}: ${t('action.open')}`} />
          )}
        </div>
      }
    />
  );
}
