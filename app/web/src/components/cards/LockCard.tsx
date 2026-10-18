import { Lock, LockOpen } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Lock: toggle locks/unlocks; the card is tinted while unlocked.
export function LockCard({ device }: { device: Device }) {
  const { t } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const locked = state.locked === true || state.locked === 'locked';
  return (
    <CardShell
      device={device}
      icon={locked ? Lock : LockOpen}
      tone={locked ? 'ok' : 'warn'}
      active={!locked}
      right={
        <div className="flex items-center gap-2">
          <Pill text={locked ? t('locked') : t('unlocked')} tone={locked ? 'on' : 'alert'} />
          {can('locked') && (
            <Toggle checked={locked} onChange={v => set('locked', v)} aria-label={`${device.name}: ${t('locked')}`} />
          )}
        </div>
      }
    />
  );
}
