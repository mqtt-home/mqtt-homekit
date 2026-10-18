import { Shield, ShieldAlert } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { CardShell } from './CardShell';

const MODES = ['off', 'home', 'away', 'night'];

// Security system: armed-state segmented control; a triggered alarm tints the
// card and shows an alert pill.
export function SecuritySystemCard({ device }: { device: Device }) {
  const { t, tx } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const current = typeof state.state === 'string' ? state.state : undefined;
  const triggered = current === 'triggered';
  const armed = current !== undefined && current !== 'off';
  return (
    <CardShell
      device={device}
      icon={triggered ? ShieldAlert : Shield}
      tone={triggered ? 'bad' : armed ? 'ok' : 'idle'}
      active={triggered}
      right={triggered
        ? <Pill text={t('alarm')} tone="bad" />
        : <Pill text={current ? tx(`mode.${current}`, current) : '—'} tone={armed ? 'on' : 'off'} />}
    >
      {can('state') && (
        <div className="flex items-center justify-between gap-3">
          <span className="lbl">{t('mode')}</span>
          <div className="seg wide" role="group" aria-label={t('mode')}>
            {MODES.map(m => (
              <button key={m} type="button" aria-pressed={current === m} onClick={() => set('state', m)}>
                {tx(`mode.${m}`, m)}
              </button>
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}
