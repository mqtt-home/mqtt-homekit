import { useEffect, useRef, useState } from 'react';
import { ThermometerSun, Minus, Plus } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num, fmtTemp } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CardShell } from './CardShell';

const MIN_TARGET = 5;
const MAX_TARGET = 35;
const STEP = 0.5;
// Rapid +/- taps are aggregated into a single command after this pause.
const COMMIT_DELAY_MS = 600;

const MODES = [
  { value: 'off', label: 'Off' },
  { value: 'heat', label: 'Heat' },
  { value: 'auto', label: 'Auto' },
];

// Thermostat: shows current temperature, adjusts the target with a stepper
// and switches the heating mode (off / heat / auto) when the device has one.
export function ThermostatCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const current = num(state.current_temperature);
  const target = num(state.target_temperature);
  const mode = typeof state.mode === 'string' ? state.mode : undefined;
  const off = mode === 'off';

  const [draft, setDraft] = useState<number | undefined>(target);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the bridge value unless the user is mid-adjustment.
  useEffect(() => {
    if (timer.current === null) setDraft(target);
  }, [target]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const step = (delta: number) => {
    const base = draft ?? target ?? 20;
    const next = Math.min(MAX_TARGET, Math.max(MIN_TARGET, base + delta));
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      set('target_temperature', next);
    }, COMMIT_DELAY_MS);
  };

  const hasControls = can('target_temperature') || can('mode');

  return (
    <CardShell
      device={device}
      icon={ThermometerSun}
      iconClass={off ? 'text-muted-foreground' : 'text-rose-500'}
      right={<span className="text-2xl font-semibold tabular-nums">{fmtTemp(current)}</span>}
    >
      {hasControls && (
        <div className="space-y-3">
          {can('mode') && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Mode</span>
              <div className="flex rounded-lg bg-muted p-0.5">
                {MODES.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => set('mode', m.value)}
                    className={cn(
                      'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                      mode === m.value
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
          {can('target_temperature') && (
            <div className={cn('flex items-center justify-between', off && 'opacity-50')}>
              <span className="text-xs text-muted-foreground">Target</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-STEP)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-muted hover:bg-accent text-foreground transition-colors"
                  aria-label="Decrease target temperature"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-lg font-semibold tabular-nums w-20 text-center">
                  {draft === undefined ? '—' : `${draft.toFixed(1)} °C`}
                </span>
                <button
                  type="button"
                  onClick={() => step(STEP)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-muted hover:bg-accent text-foreground transition-colors"
                  aria-label="Increase target temperature"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}
