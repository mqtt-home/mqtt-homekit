import { useEffect, useRef, useState, useCallback } from 'react';
import type { Device } from '@/types/homekit';
import { API_BASE } from '@/lib/api';

export type SSEError = 'err.parse' | 'err.closed' | 'err.connection' | 'err.connect';

export interface IdentifyEvent {
  name: string;
  room: string;
  at: number; // client timestamp, forces re-render on repeat identifies
}

interface SSEHookReturn {
  // Live accessory state, keyed by aid.
  devices: Record<number, Device>;
  // Last HomeKit identify request (pairing flow).
  identify: IdentifyEvent | null;
  isConnected: boolean;
  // i18n key of the last connection problem.
  error: SSEError | null;
  reconnect: () => void;
}

export function useSSE(): SSEHookReturn {
  const [devices, setDevices] = useState<Record<number, Device>>({});
  const [identify, setIdentify] = useState<IdentifyEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<SSEError | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    try {
      const eventSource = new EventSource(`${API_BASE}/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'device' && typeof data.aid === 'number') {
            setDevices(prev => ({ ...prev, [data.aid]: data as Device }));
          } else if (data.type === 'identify' && typeof data.name === 'string') {
            setIdentify({ name: data.name, room: data.room ?? '', at: Date.now() });
          }
        } catch {
          setError('err.parse');
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setError(eventSource.readyState === EventSource.CLOSED
          ? 'err.closed'
          : 'err.connection');

        reconnectTimeoutRef.current = setTimeout(() => {
          if (eventSourceRef.current === eventSource) {
            connect();
          }
        }, 3000);
      };
    } catch {
      setError('err.connect');
    }
  }, [cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const reconnect = useCallback(() => {
    setError(null);
    connect();
  }, [connect]);

  return { devices, identify, isConnected, error, reconnect };
}
