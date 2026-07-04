import { Blinds, DoorClosed, PanelTop, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import type { Device } from '@/types/homekit';
import { useDeviceControl } from '@/hooks/useDeviceControl';
import { num } from '@/lib/format';
import { Slider } from '@/components/ui/Slider';
import { CardShell } from './CardShell';

// Window covering / door / window: position slider with open/close
// shortcuts, plus an optional tilt slider for venetian blinds.
export function WindowCoveringCard({ device }: { device: Device }) {
  const { state, can, set } = useDeviceControl(device);
  const position = num(state.position);
  const tilt = num(state.tilt);
  const icon = device.kind === 'door' ? DoorClosed : device.kind === 'window' ? PanelTop : Blinds;

  return (
    <CardShell
      device={device}
      icon={icon}
      iconClass={position !== undefined && position > 0 ? 'text-indigo-400' : 'text-indigo-500'}
      active={position !== undefined && position > 0}
      right={
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-2xl font-semibold tabular-nums">
            {position === undefined ? '—' : `${Math.round(position)} %`}
          </span>
          {tilt !== undefined && (
            <span className="text-sm text-muted-foreground tabular-nums">tilt {Math.round(tilt)}°</span>
          )}
        </div>
      }
    >
      {can('position') && (
        <div className="space-y-3">
          <Slider
            label="Position"
            value={position ?? 0}
            min={0}
            max={100}
            onCommit={v => set('position', v)}
            format={v => `${v} %`}
          />
          {can('tilt') && (
            <Slider
              label="Tilt"
              value={tilt ?? 0}
              min={-90}
              max={90}
              onCommit={v => set('tilt', v)}
              format={v => `${v}°`}
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set('position', 100)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors"
            >
              <ArrowUpToLine className="h-4 w-4" /> Open
            </button>
            <button
              type="button"
              onClick={() => set('position', 0)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors"
            >
              <ArrowDownToLine className="h-4 w-4" /> Close
            </button>
          </div>
        </div>
      )}
    </CardShell>
  );
}
