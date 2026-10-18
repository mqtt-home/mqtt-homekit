import { ArrowDownToLine, ArrowUpToLine, Blinds, DoorClosed, PanelTop } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Slider } from '@/components/ui/Slider';
import { CardShell } from './CardShell';

// Window covering / door / window: position slider with open/close
// shortcuts, plus an optional tilt slider for venetian blinds.
export function WindowCoveringCard({ device }: { device: Device }) {
  const { t, pct, num: n } = useI18n();
  const { state, can, set } = useDeviceControl(device);
  const position = num(state.position);
  const tilt = num(state.tilt);
  const icon = device.kind === 'door' ? DoorClosed : device.kind === 'window' ? PanelTop : Blinds;
  const open = position !== undefined && position > 0;
  return (
    <CardShell
      device={device}
      icon={icon}
      tone={open ? 'info' : 'idle'}
      active={open}
      right={
        <div className="flex flex-col items-end gap-0.5">
          <span className="val">{pct(position)}</span>
          {tilt !== undefined && <span className="val-2">{t('tilt.value', { v: n(Math.round(tilt)) })}</span>}
        </div>
      }
    >
      {can('position') && (
        <div>
          <Slider label={t('position')} value={position ?? 0} min={0} max={100}
            onCommit={v => set('position', v)} format={pct} />
          {can('tilt') && (
            <Slider label={t('tilt')} value={tilt ?? 0} min={-90} max={90}
              onCommit={v => set('tilt', v)} format={v => `${n(v)}°`} />
          )}
          <div className="mt-1 flex gap-2">
            <button type="button" className="btn flex-1" onClick={() => set('position', 100)}>
              <ArrowUpToLine /> {t('action.open')}
            </button>
            <button type="button" className="btn flex-1" onClick={() => set('position', 0)}>
              <ArrowDownToLine /> {t('action.close')}
            </button>
          </div>
        </div>
      )}
    </CardShell>
  );
}
