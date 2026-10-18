import { Plug, Power } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Switch / outlet: on-off toggle (falls back to a status pill when the
// accessory has no writable topic).
export function SwitchCard({ device }: { device: Device }) {
  const { t } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;
  return (
    <CardShell
      device={device}
      icon={device.kind === 'outlet' ? Plug : Power}
      tone={on ? 'ok' : 'idle'}
      active={on}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={t('onOff', { name: device.name })} />
        : <Pill text={on ? t('on') : t('off')} tone={on ? 'on' : 'off'} />}
    />
  );
}
