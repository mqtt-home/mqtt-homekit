import { useEffect, useState } from 'react';
import { BadgeCheck, MapPin } from 'lucide-react';
import type { IdentifyEvent } from '@/hooks/useSSE';

const SHOW_MS = 8000;

// Full-screen overlay shown when HomeKit asks a device to identify itself
// (the "Identify" button while adding accessories). Shows device and room so
// the accessory being placed can be recognized, then fades out.
export function IdentifyModal({ identify }: { identify: IdentifyEvent | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!identify) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(t);
  }, [identify]);

  if (!identify || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={() => setVisible(false)}
    >
      <div className="bg-card border-2 border-primary rounded-2xl px-10 py-8 shadow-2xl text-center animate-pulse">
        <BadgeCheck className="h-10 w-10 text-primary mx-auto mb-3" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Identify</p>
        <p className="text-3xl font-bold text-foreground">{identify.name}</p>
        {identify.room && (
          <p className="mt-2 text-lg text-muted-foreground flex items-center justify-center gap-1.5">
            <MapPin className="h-4 w-4" /> {identify.room}
          </p>
        )}
      </div>
    </div>
  );
}
