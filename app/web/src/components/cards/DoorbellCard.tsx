import { BellRing, Bell } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { Pill } from '@/components/ui/Pill';
import { CardShell } from './CardShell';

// Doorbell: shows the last ring (the event itself fires a HomeKit
// notification on every press).
export function DoorbellCard({ device }: { device: Device }) {
  const event = typeof device.state.last_event === 'string' ? device.state.last_event : undefined;

  return (
    <CardShell
      device={device}
      icon={event ? BellRing : Bell}
      iconClass={event ? 'text-primary' : 'text-muted-foreground'}
      right={event
        ? <Pill text={event} tone="neutral" />
        : <span className="text-sm text-muted-foreground italic">no rings yet</span>}
    />
  );
}
