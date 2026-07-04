import { Lightbulb } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num } from '@/lib/format';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { Slider } from '@/components/ui/Slider';
import { CardShell } from './CardShell';

// Light: on-off toggle plus a brightness slider when dimmable.
export function LightbulbCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;
  const brightness = num(state.brightness);

  return (
    <CardShell
      device={device}
      icon={Lightbulb}
      iconClass={on ? 'text-yellow-500' : 'text-muted-foreground'}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={`${device.name} on/off`} />
        : <Pill text={on ? 'On' : 'Off'} tone={on ? 'on' : 'off'} />}
    >
      {can('brightness') && (
        <Slider
          label="Brightness"
          value={brightness ?? 0}
          min={1}
          max={100}
          onCommit={v => set('brightness', v)}
          format={v => `${v} %`}
        />
      )}
    </CardShell>
  );
}
