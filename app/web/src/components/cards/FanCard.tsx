import { Fan } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num } from '@/lib/format';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { Slider } from '@/components/ui/Slider';
import { CardShell } from './CardShell';

// Fan: on-off toggle plus a rotation speed slider when available.
export function FanCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;
  const speed = num(state.speed);

  return (
    <CardShell
      device={device}
      icon={Fan}
      iconClass={on ? 'text-sky-500' : 'text-muted-foreground'}
      active={on}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={`${device.name} on/off`} />
        : <Pill text={on ? 'On' : 'Off'} tone={on ? 'on' : 'off'} />}
    >
      {can('speed') && (
        <Slider
          label="Speed"
          value={speed ?? 0}
          min={0}
          max={100}
          onCommit={v => set('speed', v)}
          format={v => `${v} %`}
        />
      )}
    </CardShell>
  );
}
