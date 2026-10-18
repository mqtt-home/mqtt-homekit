import { CircleDot } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { num } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { CardShell } from './CardShell';

// Stateless programmable switch: shows the last button event (the events
// themselves are momentary and fire HomeKit automations directly).
export function ButtonCard({ device }: { device: Device }) {
  const { t } = useI18n();
  const btn = num(device.state.last_button);
  const event = typeof device.state.last_event === 'string' ? device.state.last_event : undefined;
  return (
    <CardShell
      device={device}
      icon={CircleDot}
      tone={event ? 'info' : 'idle'}
      right={event
        ? <Pill text={t('button.event', { n: btn ?? 1, event })} tone="neutral" />
        : <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{t('button.none')}</span>}
    />
  );
}
