import type { Device, Info } from '@/types/homekit';

export const API_BASE = import.meta.env.DEV ? 'http://localhost:8080/api' : '/api';

export async function fetchInfo(): Promise<Info> {
  const response = await fetch(`${API_BASE}/info`);
  if (!response.ok) throw new Error('Failed to fetch info');
  return response.json();
}

export async function fetchDevices(): Promise<Device[]> {
  const response = await fetch(`${API_BASE}/devices`);
  if (!response.ok) throw new Error('Failed to fetch devices');
  return response.json();
}

// Set a writable characteristic (e.g. { name: "on", value: true }).
export async function controlDevice(aid: number, name: string, value: unknown): Promise<Device> {
  const response = await fetch(`${API_BASE}/devices/${aid}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, value }),
  });
  if (!response.ok) throw new Error((await response.text()) || 'Control failed');
  return response.json();
}
