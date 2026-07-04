import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  // Called once when the user releases the slider (not on every tick).
  onCommit: (value: number) => void;
  label?: string;
  format?: (value: number) => string;
  disabled?: boolean;
}

// Range slider that tracks locally while dragging and commits on release, so
// a drag produces one MQTT command instead of dozens.
export function Slider({ value, min, max, step = 1, onCommit, label, format, disabled }: Props) {
  // Snap incoming values to the step grid: MQTT factor/offset transforms can
  // produce values like 2.22e-16 that would otherwise leak into the display.
  const snap = (v: number) => {
    const snapped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
  };

  const [local, setLocal] = useState(snap(value));
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setLocal(snap(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit(local);
  };

  const pct = max === min ? 0 : ((local - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        onChange={e => {
          dragging.current = true;
          setLocal(Number(e.target.value));
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="slider w-full disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-input) ${pct}%)`,
        }}
        aria-label={label}
      />
      <span className="text-sm font-medium tabular-nums text-foreground w-14 text-right shrink-0">
        {format ? format(local) : local}
      </span>
    </div>
  );
}
