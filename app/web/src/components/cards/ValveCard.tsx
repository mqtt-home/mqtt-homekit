import { Droplet } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Valve / faucet: simple open-close toggle.
export function ValveCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;

  return (
    <CardShell
      device={device}
      icon={Droplet}
      iconClass={on ? 'text-sky-500' : 'text-muted-foreground'}
      active={on}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={`${device.name} valve`} />
        : <Pill text={on ? 'Open' : 'Closed'} tone={on ? 'on' : 'off'} />}
    />
  );
}
