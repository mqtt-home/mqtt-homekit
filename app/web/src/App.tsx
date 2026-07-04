import { useEffect, useMemo, useState } from 'react';
import { Sun, Moon, Wifi, WifiOff, House, RefreshCw, KeyRound } from 'lucide-react';
import { useSSE } from '@/hooks/useSSE';
import { fetchDevices, fetchInfo, API_BASE } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { DeviceCard } from '@/components/DeviceCard';
import { CategoryFilter, matchesCategory, type CategoryKey } from '@/components/CategoryFilter';
import { BatteryOverview } from '@/components/BatteryOverview';
import { IdentifyModal } from '@/components/IdentifyModal';
import { cn } from '@/lib/utils';
import type { Device, Info } from '@/types/homekit';

export function App() {
  const [info, setInfo] = useState<Info | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState<CategoryKey>('all');
  const { devices: liveStates, identify, isConnected, error, reconnect } = useSSE();
  const { theme, toggleTheme } = useTheme();

  const load = () => {
    Promise.all([fetchInfo(), fetchDevices()])
      .then(([i, d]) => { setInfo(i); setDevices(d); })
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <IdentifyModal identify={identify} />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <House className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground leading-tight">MQTT HomeKit</h1>
              {info?.bridge && (
                <p className="text-xs text-muted-foreground truncate">{info.bridge}</p>
              )}
            </div>
            <span
              className={cn('ml-2 h-2.5 w-2.5 rounded-full shrink-0', healthy ? 'bg-green-500' : 'bg-red-500')}
              title={healthy ? 'Healthy' : 'Unhealthy'}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={load} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Refresh" title="Refresh">
              <RefreshCw className="h-5 w-5 text-foreground" />
            </button>
            <div className="p-2" title={isConnected ? 'Connected' : 'Disconnected'}>
              {isConnected
                ? <Wifi className="h-5 w-5 text-green-500" />
                : <WifiOff className="h-5 w-5 text-red-500 cursor-pointer" onClick={reconnect} />}
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5 text-foreground" /> : <Moon className="h-5 w-5 text-foreground" />}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
            {error}
            <button onClick={reconnect} className="ml-2 underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Pairing panel */}
        {info && (
          <div className="mb-6 bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row items-center gap-5">
            <img
              src={`${API_BASE}/qr`}
              alt="HomeKit pairing QR code"
              className="h-40 w-40 rounded-lg bg-white p-2 shrink-0"
            />
            <div className="flex flex-col items-center sm:items-start gap-2 text-center sm:text-left">
              <div className="flex items-center gap-2 text-muted-foreground">
                <KeyRound className="h-4 w-4" />
                <span className="text-sm">Scan or enter to pair in Apple Home</span>
              </div>
              <div className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground tabular-nums">
                {info.pin}
              </div>
              <p className="text-xs text-muted-foreground">
                {info.accessories} {info.accessories === 1 ? 'accessory' : 'accessories'}
              </p>
            </div>
          </div>
        )}

        {/* Battery overview */}
        {loaded && <BatteryOverview devices={merged} />}

        {/* Category filter */}
        {loaded && merged.length > 0 && (
          <CategoryFilter devices={merged} active={category} onChange={setCategory} />
        )}

        {/* Accessory grid, grouped by room */}
        {!loaded ? (
          <div className="text-muted-foreground text-center py-16">Loading accessories...</div>
        ) : merged.length === 0 ? (
          <div className="text-muted-foreground text-center py-16">No accessories found.</div>
        ) : rooms.empty ? (
          <div className="text-muted-foreground text-center py-16">No accessories in this category.</div>
        ) : (
          <div className="space-y-8">
            {rooms.named.map(([room, devs]) => (
              <section key={room}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {room}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {devs.map(device => (
                    <DeviceCard key={device.aid} device={device} />
                  ))}
                </div>
              </section>
            ))}
            {rooms.unassigned.length > 0 && (
              <section>
                {rooms.named.length > 0 && (
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Other
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.unassigned.map(device => (
                    <DeviceCard key={device.aid} device={device} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-muted-foreground">mqtt-homekit</div>
      </div>
    </div>
  );
}
