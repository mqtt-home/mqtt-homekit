import { Fan } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Fan: on-off toggle plus a rotation speed slider when available.
export function FanCard({ device }: { device: Device }) {
  const { t, pct } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;
  const speed = num(state.speed);
  return (
    <CardShell
      device={device}
      icon={Fan}
      tone={on ? 'ok' : 'idle'}
      active={on}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={t('onOff', { name: device.name })} />
        : <Pill text={on ? t('on') : t('off')} tone={on ? 'on' : 'off'} />}
    >
      {can('speed') && (
        <Slider label={t('speed')} value={speed ?? 0} min={0} max={100} onCommit={v => set('speed', v)} format={pct} />
      )}
    </CardShell>
  );
}
