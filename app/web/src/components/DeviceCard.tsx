import type { Device } from '@/types/homekit';
import { SensorCard } from './cards/SensorCard';
import { SwitchCard } from './cards/SwitchCard';
import { LightbulbCard } from './cards/LightbulbCard';
import { WindowCoveringCard } from './cards/WindowCoveringCard';
import { ThermostatCard } from './cards/ThermostatCard';
import { ButtonCard } from './cards/ButtonCard';
import { FanCard } from './cards/FanCard';
import { LockCard } from './cards/LockCard';
import { GarageDoorCard } from './cards/GarageDoorCard';
import { ValveCard } from './cards/ValveCard';
import { DoorbellCard } from './cards/DoorbellCard';
import { SecuritySystemCard } from './cards/SecuritySystemCard';

// Dispatches to the card component for the accessory kind. Sensors are
// read-only; the other cards expose their writable characteristics.
export function DeviceCard({ device }: { device: Device }) {
  switch (device.kind) {
    case 'switch':
    case 'outlet':
      return <SwitchCard device={device} />;
    case 'lightbulb':
      return <LightbulbCard device={device} />;
    case 'window_covering':
    case 'blind':
    case 'shade':
    case 'door':
    case 'window':
      return <WindowCoveringCard device={device} />;
    case 'thermostat':
    case 'radiator':
      return <ThermostatCard device={device} />;
    case 'button':
      return <ButtonCard device={device} />;
    case 'fan':
      return <FanCard device={device} />;
    case 'lock':
      return <LockCard device={device} />;
    case 'garage_door':
      return <GarageDoorCard device={device} />;
    case 'valve':
      return <ValveCard device={device} />;
    case 'doorbell':
      return <DoorbellCard device={device} />;
    case 'security_system':
      return <SecuritySystemCard device={device} />;
    default:
      return <SensorCard device={device} />;
  }
}
