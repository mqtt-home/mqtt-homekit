import { CircleDot } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { num } from '@/lib/format';
import { Pill } from '@/components/ui/Pill';
import { CardShell } from './CardShell';

// Stateless programmable switch: shows the last button event (the events
// themselves are momentary and fire HomeKit automations directly).
export function ButtonCard({ device }: { device: Device }) {
  const btn = num(device.state.last_button);
  const event = typeof device.state.last_event === 'string' ? device.state.last_event : undefined;

  return (
    <CardShell
      device={device}
      icon={CircleDot}
      iconClass={event ? 'text-primary' : 'text-muted-foreground'}
      right={event
        ? <Pill text={`Button ${btn ?? 1} · ${event}`} tone="neutral" />
        : <span className="text-sm text-muted-foreground italic">no events yet</span>}
    />
  );
}
