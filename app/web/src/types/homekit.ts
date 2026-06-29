// Accessory kinds exposed by the bridge.
export type DeviceKind =
  | 'temperature'
  | 'humidity'
  | 'temperature_humidity'
  | 'contact'
  | 'motion'
  | 'switch'
  | 'outlet'
  | 'lightbulb'
  | 'window_covering'
  | 'thermostat';

// One accessory. `state` may be empty ({}) until the first MQTT message arrives.
export interface Device {
  type: 'device'; // SSE discriminator (always "device")
  aid: number; // stable id — used as React key and SSE merge key
  name: string;
  kind: string;
  state: Record<string, unknown>;
}

// Bridge info + pairing details.
export interface Info {
  bridge: string;
  pin: string;
  setup_id: string;
  setup_uri: string;
  accessories: number;
  healthy: boolean;
}

// True when the accessory has not yet received any MQTT state.
export function isWaiting(device: Device): boolean {
  return !device.state || Object.keys(device.state).length === 0;
}
