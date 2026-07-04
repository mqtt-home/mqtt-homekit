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
      active={on}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={`${device.name} on/off`} />
        : <Pill text={on ? 'On' : 'Off'} tone={on ? 'on' : 'off'} />}
    >
      {(can('brightness') || can('color_temperature') || can('hue') || can('saturation')) && (
        <div className="space-y-3">
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
          {can('color_temperature') && (
            <Slider
              label="Warmth"
              value={num(state.color_temperature) ?? 140}
              min={140}
              max={500}
              onCommit={v => set('color_temperature', v)}
              format={v => `${v}`}
            />
          )}
          {can('hue') && (
            <Slider
              label="Hue"
              value={num(state.hue) ?? 0}
              min={0}
              max={360}
              onCommit={v => set('hue', v)}
              format={v => `${v}°`}
            />
          )}
          {can('saturation') && (
            <Slider
              label="Saturation"
              value={num(state.saturation) ?? 0}
              min={0}
              max={100}
              onCommit={v => set('saturation', v)}
              format={v => `${v} %`}
            />
          )}
        </div>
      )}
    </CardShell>
  );
}
