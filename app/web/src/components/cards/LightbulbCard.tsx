import { Lightbulb } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Light: on-off toggle plus a brightness slider when dimmable.
export function LightbulbCard({ device }: { device: Device }) {
  const { t, pct, num: n } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;
  const brightness = num(state.brightness);
  return (
    <CardShell
      device={device}
      icon={Lightbulb}
      tone={on ? 'light' : 'idle'}
      active={on}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={t('onOff', { name: device.name })} />
        : <Pill text={on ? t('on') : t('off')} tone={on ? 'on' : 'off'} />}
    >
      {(can('brightness') || can('color_temperature') || can('hue') || can('saturation')) && (
        <div>
          {can('brightness') && (
            <Slider label={t('brightness')} value={brightness ?? 0} min={1} max={100}
              onCommit={v => set('brightness', v)} format={pct} />
          )}
          {can('color_temperature') && (
            <Slider label={t('warmth')} value={num(state.color_temperature) ?? 140} min={140} max={500}
              onCommit={v => set('color_temperature', v)} format={v => n(v)} />
          )}
          {can('hue') && (
            <Slider label={t('hue')} value={num(state.hue) ?? 0} min={0} max={360}
              onCommit={v => set('hue', v)} format={v => `${n(v)}°`} />
          )}
          {can('saturation') && (
            <Slider label={t('saturation')} value={num(state.saturation) ?? 0} min={0} max={100}
              onCommit={v => set('saturation', v)} format={pct} />
          )}
        </div>
      )}
    </CardShell>
  );
}
