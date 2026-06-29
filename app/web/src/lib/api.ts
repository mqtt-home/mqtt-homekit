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
