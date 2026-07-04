import { Shield, ShieldAlert } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { CardShell } from './CardShell';

const MODES = [
  { value: 'off', label: 'Off' },
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
  { value: 'night', label: 'Night' },
];

// Security system: armed-state segmented control; triggered alarms lift the
// card and show an alert pill.
export function SecuritySystemCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const current = typeof state.state === 'string' ? state.state : undefined;
  const triggered = current === 'triggered';
  const armed = current !== undefined && current !== 'off';

  return (
    <CardShell
      device={device}
      icon={triggered ? ShieldAlert : Shield}
      iconClass={triggered ? 'text-red-500' : armed ? 'text-green-500' : 'text-muted-foreground'}
      active={triggered}
      right={triggered
        ? <Pill text="ALARM" tone="alert" />
        : <Pill text={current ?? '—'} tone={armed ? 'on' : 'off'} />}
    >
      {can('state') && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Mode</span>
          <div className="flex rounded-lg bg-muted p-0.5">
            {MODES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => set('state', m.value)}
                className={cn(
                  'px-2.5 py-1 text-sm font-medium rounded-md transition-colors',
                  current === m.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}
