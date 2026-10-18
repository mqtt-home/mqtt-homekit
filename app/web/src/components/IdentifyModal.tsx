import { useEffect, useState } from 'react';
import { BadgeCheck, MapPin } from 'lucide-react';
import type { IdentifyEvent } from '@/hooks/useSSE';
import { useI18n } from '@/lib/i18n';

const SHOW_MS = 8000;

// Full-screen overlay shown when HomeKit asks a device to identify itself
// (the "Identify" button while adding accessories). Shows device and room so
// the accessory being placed can be recognized, then fades out.
export function IdentifyModal({ identify }: { identify: IdentifyEvent | null }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!identify) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [identify]);

  if (!identify || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'color-mix(in oklab, var(--canvas) 70%, transparent)' }}
      onClick={() => setVisible(false)}
    >
      <div
        className="card px-10 py-8 text-center"
        style={{ boxShadow: 'var(--elevation-3), 0 0 0 4px var(--focus)', borderColor: 'var(--accent)' }}
      >
        <span className="ico mx-auto mb-3" style={{ width: 52, height: 52, borderRadius: 16 }}>
          <BadgeCheck />
        </span>
        <p className="kicker mb-2">{t('identify')}</p>
        <p className="text-3xl font-semibold tracking-tight">{identify.name}</p>
        {identify.room && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-lg" style={{ color: 'var(--ink-3)' }}>
            <MapPin className="size-4" /> {identify.room}
          </p>
        )}
      </div>
    </div>
  );
}
