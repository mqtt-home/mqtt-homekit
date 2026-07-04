import { useCallback, useEffect, useState } from 'react';
import type { Device } from '@/types/homekit';
import { controlDevice } from '@/lib/api';

interface DeviceControl {
  // Device state with optimistic overrides applied.
  state: Record<string, unknown>;
  // True when the characteristic is writable on this device.
  can: (name: string) => boolean;
  // Set a characteristic; applies an optimistic override until the bridge
  // confirms via SSE (or reverts it if the request fails).
  set: (name: string, value: unknown) => void;
}

export function useDeviceControl(device: Device): DeviceControl {
  const [pending, setPending] = useState<Record<string, unknown>>({});

  // Authoritative state from the bridge clears optimistic overrides.
  useEffect(() => {
    setPending({});
  }, [device.state]);

  const set = useCallback(
    (name: string, value: unknown) => {
      setPending(p => ({ ...p, [name]: value }));
      controlDevice(device.aid, name, value).catch(err => {
        console.error('control failed', err);
        setPending(p => {
          const next = { ...p };
          delete next[name];
          return next;
        });
      });
    },
    [device.aid],
  );

  const can = useCallback(
    (name: string) => device.controls?.includes(name) ?? false,
    [device.controls],
  );

  return { state: { ...device.state, ...pending }, can, set };
}
