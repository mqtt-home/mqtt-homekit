import { Droplet } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { CardShell } from './CardShell';

// Valve / faucet: simple open-close toggle.
export function ValveCard({ device }: { device: Device }) {
  const { t } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const on = state.on === true;
  return (
    <CardShell
      device={device}
      icon={Droplet}
      tone={on ? 'info' : 'idle'}
      active={on}
      right={can('on')
        ? <Toggle checked={on} onChange={v => set('on', v)} aria-label={t('onOff', { name: device.name })} />
        : <Pill text={on ? t('open') : t('closed')} tone={on ? 'on' : 'off'} />}
    />
  );
}
