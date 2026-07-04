import { Power, Plug } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Switch / outlet: on-off toggle (falls back to a status pill when the
// accessory has no writable topic).
export function SwitchCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;
  return (
    <CardShell
      device={device}
      icon={device.kind === 'outlet' ? Plug : Power}
      iconClass={on ? 'text-green-500' : 'text-muted-foreground'}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={`${device.name} on/off`} />
        : <Pill text={on ? 'On' : 'Off'} tone={on ? 'on' : 'off'} />}
    />
  );
}
