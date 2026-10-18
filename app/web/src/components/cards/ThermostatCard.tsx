import { useEffect, useRef, useState } from 'react';
import { ThermometerSun, Minus, Plus } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CardShell } from './CardShell';

const MIN_TARGET = 5;
const MAX_TARGET = 35;
const STEP = 0.5;
// Rapid +/- taps are aggregated into a single command after this pause.
const COMMIT_DELAY_MS = 600;

const MODES = ['off', 'heat', 'auto'];

// Thermostat: shows current temperature, adjusts the target with a stepper
// and switches the heating mode (off / heat / auto) when the device has one.
export function ThermostatCard({ device }: { device: Device }) {
  const { t, tx, temp } = useI18n();
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
      tone={off ? 'idle' : 'accent'}
      right={<span className="val">{temp(current)}</span>}
    >
      {hasControls && (
        <div className="space-y-3">
          {can('mode') && (
            <div className="flex items-center justify-between gap-3">
              <span className="lbl">{t('mode')}</span>
              <div className="seg wide" role="group" aria-label={t('mode')}>
                {MODES.map(m => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => set('mode', m)}>
                    {tx(`mode.${m}`, m)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {can('target_temperature') && (
            <div className={cn('flex items-center justify-between gap-3', off && 'opacity-50')}>
              <span className="lbl">{t('target')}</span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn sq" onClick={() => step(-STEP)} aria-label={t('target.down')}>
                  <Minus />
                </button>
                <span className="num w-20 text-center text-lg font-semibold">{temp(draft)}</span>
                <button type="button" className="btn sq" onClick={() => step(STEP)} aria-label={t('target.up')}>
                  <Plus />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}
