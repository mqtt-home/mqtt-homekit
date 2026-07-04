import { Warehouse, TriangleAlert } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Garage door: open/close toggle with an obstruction warning.
export function GarageDoorCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const open = state.open === true || state.open === 'open';
  const obstructed = state.obstruction === 'obstructed';

  return (
    <CardShell
      device={device}
      icon={Warehouse}
      iconClass={open ? 'text-amber-500' : 'text-muted-foreground'}
      active={open}
      right={
        <div className="flex items-center gap-2">
          {obstructed && <TriangleAlert className="h-5 w-5 text-red-500" />}
          <Pill text={open ? 'Open' : 'Closed'} tone={open ? 'alert' : 'off'} />
          {can('open') && (
            <Toggle checked={open} onChange={v => set('open', v)} aria-label={`${device.name} open/close`} />
          )}
        </div>
      }
    />
  );
}
