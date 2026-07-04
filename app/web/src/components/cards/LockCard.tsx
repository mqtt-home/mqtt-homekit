import { Lock, LockOpen } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Lock: toggle locks/unlocks; the card lifts while unlocked.
export function LockCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const locked = state.locked === true || state.locked === 'locked';

  return (
    <CardShell
      device={device}
      icon={locked ? Lock : LockOpen}
      iconClass={locked ? 'text-green-500' : 'text-amber-500'}
      active={!locked}
      right={
        <div className="flex items-center gap-2">
          <Pill text={locked ? 'Locked' : 'Unlocked'} tone={locked ? 'on' : 'alert'} />
          {can('locked') && (
            <Toggle checked={locked} onChange={v => set('locked', v)} aria-label={`${device.name} lock`} />
          )}
        </div>
      }
    />
  );
}
