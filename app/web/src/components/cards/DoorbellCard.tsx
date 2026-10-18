import { Bell, BellRing } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useI18n } from '@/lib/i18n';
import { Pill } from '@/components/ui/Pill';
import { CardShell } from './CardShell';

// Doorbell: shows the last ring (the event itself fires a HomeKit
// notification on every press).
export function DoorbellCard({ device }: { device: Device }) {
  const { t } = useI18n();
  const event = typeof device.state.last_event === 'string' ? device.state.last_event : undefined;
  return (
    <CardShell
      device={device}
      icon={event ? BellRing : Bell}
      tone={event ? 'info' : 'idle'}
      right={event
        ? <Pill text={event} tone="neutral" />
        : <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{t('doorbell.none')}</span>}
    />
  );
}
