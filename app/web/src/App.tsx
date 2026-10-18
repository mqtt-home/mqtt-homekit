import { useEffect, useMemo, useState } from 'react';
import { House, KeyRound, RefreshCw, WifiOff } from 'lucide-react';
import { useSSE } from '@/hooks/useSSE';
import { fetchDevices, fetchInfo, API_BASE } from '@/lib/api';
import { LangSwitch, useI18n } from '@/lib/i18n';
import { DeviceCard } from '@/components/DeviceCard';
import { CategoryFilter, matchesCategory, type CategoryKey } from '@/components/CategoryFilter';
import { BatteryOverview } from '@/components/BatteryOverview';
import { IdentifyModal } from '@/components/IdentifyModal';
import type { Device, Info } from '@/types/homekit';

export function App() {
  const { t } = useI18n();
  const [info, setInfo] = useState<Info | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState<CategoryKey>('all');
  // Pairing code stays hidden until asked for, so it isn't on screen every
  // time the dashboard is opened.
  const [showPairing, setShowPairing] = useState(false);
  const { devices: liveStates, identify, isConnected, error, reconnect } = useSSE();

  const load = () => {
    Promise.all([fetchInfo(), fetchDevices()])
      .then(([i, d]) => { setInfo(i); setDevices(d ?? []); })
      .catch(console.error)
      .finally(() => setLoaded(true));
  };

  useEffect(() => { load(); }, []);

  // Merge live SSE state (keyed by aid) over the initial device list.
  const merged = useMemo<Device[]>(() => {
    return devices.map(d => liveStates[d.aid] ?? d);
  }, [devices, liveStates]);

  // Category filter, then group by room preserving config order; unassigned
  // devices come last.
  const rooms = useMemo(() => {
    const filtered = merged.filter(d => matchesCategory(d, category));
    const groups = new Map<string, Device[]>();
    for (const d of filtered) {
      const room = d.room || '';
      if (!groups.has(room)) groups.set(room, []);
      groups.get(room)!.push(d);
    }
    const named = [...groups.entries()].filter(([room]) => room !== '');
    const unassigned = groups.get('') ?? [];
    return { named, unassigned, empty: filtered.length === 0 };
  }, [merged, category]);

  const healthy = !!info?.healthy && isConnected;
  const pairingLabel = showPairing ? t('pairing.hide') : t('pairing.show');

  return (
    <div className="min-h-screen">
      <IdentifyModal identify={identify} />
      <header className="top-bar">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-safe py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="ico">
              <House />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[17px] leading-tight font-semibold tracking-tight">{t('title')}</h1>
              <div className="flex min-w-0 items-center gap-1.5 text-xs" style={{ color: 'var(--ink-3)' }}>
                <span className={healthy ? 'dot' : 'dot bad'} title={healthy ? t('healthy') : t('unhealthy')} />
                <span className="truncate">
                  {!isConnected ? t('disconnected') : info?.bridge ?? (healthy ? t('healthy') : t('unhealthy'))}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            {info && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPairing(v => !v)}
                aria-label={pairingLabel}
                aria-pressed={showPairing}
                title={pairingLabel}
              >
                <KeyRound />
              </button>
            )}
            {!isConnected ? (
              <button type="button" className="icon-btn" onClick={reconnect} aria-label={t('retry')} title={t('retry')}>
                <WifiOff style={{ color: 'var(--alert)' }} />
              </button>
            ) : (
              <button type="button" className="icon-btn" onClick={load} aria-label={t('refresh')} title={t('refresh')}>
                <RefreshCw />
              </button>
            )}
          </div>
          <LangSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-safe pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {error && (
          <div className="alert-banner">
            <span className="ico sm"><WifiOff /></span>
            <div className="t min-w-0 flex-1">{t(error)}</div>
            <button type="button" className="btn" onClick={reconnect}>{t('retry')}</button>
          </div>
        )}

        {/* Pairing panel */}
        {info && showPairing && (
          <div className="card flex flex-col items-center gap-5 p-5 sm:flex-row">
            <img
              src={`${API_BASE}/qr`}
              alt={t('pairing.qr')}
              className="size-40 shrink-0 rounded-xl bg-white p-2"
              style={{ boxShadow: 'var(--elevation-1)', border: '1px solid var(--line)' }}
            />
            <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <div className="kicker flex items-center gap-2">
                <KeyRound className="size-4" />
                {t('pairing.title')}
              </div>
              <div className="pin">{info.pin}</div>
              <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{t('pairing.hint')}</p>
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                {info.accessories === 1 ? t('pairing.count1') : t('pairing.count', { n: info.accessories })}
              </p>
            </div>
          </div>
        )}

        {loaded && <BatteryOverview devices={merged} />}

        {loaded && merged.length > 0 && (
          <CategoryFilter devices={merged} active={category} onChange={setCategory} />
        )}

        {/* Accessory grid, grouped by room */}
        {!loaded ? (
          <Empty text={t('loading')} />
        ) : merged.length === 0 ? (
          <Empty text={t('empty.all')} />
        ) : rooms.empty ? (
          <Empty text={t('empty.category')} />
        ) : (
          <div className="space-y-7 pt-1">
            {rooms.named.map(([room, devs]) => (
              <Room key={room} title={room} devices={devs} />
            ))}
            {rooms.unassigned.length > 0 && (
              <Room title={rooms.named.length > 0 ? t('room.other') : undefined} devices={rooms.unassigned} />
            )}
          </div>
        )}

        <div className="pt-4 text-center text-xs" style={{ color: 'var(--ink-4)' }}>mqtt-homekit</div>
      </main>
    </div>
  );
}

function Room({ title, devices }: { title?: string; devices: Device[] }) {
  return (
    <section>
      {title && (
        <div className="sec-title">
          <h2>{title}</h2>
          <span className="r num">{devices.length}</span>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        {devices.map(device => (
          <DeviceCard key={device.aid} device={device} />
        ))}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-16 text-center" style={{ color: 'var(--ink-3)' }}>
      {text}
    </div>
  );
}
