import type { Device } from '@/types/homekit';

export interface TypeSpec {
  kind: string;
  title: string;
  blurb: string;
  // characteristic name -> short description; set marks writable ones.
  gets: [string, string][];
  sets: string[];
  yaml: string;
  devices: Device[];
}

let aid = 1000;
function dev(kind: string, name: string, state: Record<string, unknown>, controls: string[] = [], room = ''): Device {
  return { type: 'device', aid: aid++, name, kind, room, state, controls };
}

export const TYPES: TypeSpec[] = [
  {
    kind: 'temperature',
    title: 'Temperature Sensor',
    blurb: 'Single temperature value, plain payload or JSON path.',
    gets: [['temperature', '°C']],
    sets: [],
    yaml: `- name: Living Room
  type: temperature
  room: Living Room
  get:
    temperature: { topic: home/livingroom/sensor, path: temperature }`,
    devices: [dev('temperature', 'Living Room', { temperature: 21.5 })],
  },
  {
    kind: 'temperature_humidity',
    title: 'Temperature & Humidity',
    blurb: 'Combined climate sensor — one HomeKit accessory with two services.',
    gets: [['temperature', '°C'], ['humidity', '%'], ['battery', '% (optional)']],
    sets: [],
    yaml: `- name: Bedroom
  type: temperature_humidity
  get:
    temperature: { topic: zigbee2mqtt/bedroom, path: temperature }
    humidity: { topic: zigbee2mqtt/bedroom, path: humidity }
    battery: { topic: zigbee2mqtt/bedroom, path: battery }`,
    devices: [dev('temperature_humidity', 'Bedroom', { temperature: 19.8, humidity: 52, battery: 84 })],
  },
  {
    kind: 'humidity',
    title: 'Humidity Sensor',
    blurb: 'Relative humidity — also handy for “progress as humidity” hacks.',
    gets: [['humidity', '%']],
    sets: [],
    yaml: `- name: Bathroom
  type: humidity
  get:
    humidity: { topic: home/bath/sensor, path: humidity }`,
    devices: [dev('humidity', 'Bathroom', { humidity: 61 })],
  },
  {
    kind: 'contact',
    title: 'Contact Sensor',
    blurb: 'Door/window contact with custom payload mapping. Open lifts the card.',
    gets: [['contact', 'on = open'], ['battery', '% (optional)']],
    sets: [],
    yaml: `- name: Front Door
  type: contact
  get:
    contact: { topic: zigbee2mqtt/front-door, path: contact, "on": "false", "off": "true" }`,
    devices: [
      dev('contact', 'Front Door', { contact: 'open', battery: 92 }),
      dev('contact', 'Terrace Door', { contact: 'closed', battery: 78 }),
    ],
  },
  {
    kind: 'motion',
    title: 'Motion Sensor',
    blurb: 'Motion detection; detected state highlights the card.',
    gets: [['motion', 'boolean']],
    sets: [],
    yaml: `- name: Hallway Motion
  type: motion
  get:
    motion: { topic: hue/motion/hallway, path: presence }`,
    devices: [dev('motion', 'Hallway Motion', { motion: 'detected' })],
  },
  {
    kind: 'occupancy',
    title: 'Occupancy Sensor',
    blurb: 'Presence-style rules — semantically nicer than motion.',
    gets: [['occupancy', 'boolean']],
    sets: [],
    yaml: `- name: Office Occupancy
  type: occupancy
  get:
    occupancy: { topic: home/office/presence }`,
    devices: [dev('occupancy', 'Office Occupancy', { occupancy: 'occupied' })],
  },
  {
    kind: 'leak',
    title: 'Leak Sensor',
    blurb: 'Water leak alarm — HomeKit raises a critical notification.',
    gets: [['leak', 'boolean']],
    sets: [],
    yaml: `- name: Washing Machine
  type: leak
  get:
    leak: { topic: zigbee2mqtt/leak-washer, path: water_leak }`,
    devices: [dev('leak', 'Washing Machine', { leak: 'leak' })],
  },
  {
    kind: 'smoke',
    title: 'Smoke Sensor',
    blurb: 'Smoke alarm state.',
    gets: [['smoke', 'boolean']],
    sets: [],
    yaml: `- name: Kitchen Smoke
  type: smoke
  get:
    smoke: { topic: zigbee2mqtt/smoke-kitchen, path: smoke }`,
    devices: [dev('smoke', 'Kitchen Smoke', { smoke: 'clear' })],
  },
  {
    kind: 'co2',
    title: 'CO₂ / CO Sensor',
    blurb: 'Detected flag plus optional concentration level (types: co, co2).',
    gets: [['co / co2', 'boolean'], ['level', 'ppm (optional)']],
    sets: [],
    yaml: `- name: Office CO2
  type: co2
  get:
    co2: { topic: home/office/co2, path: alarm }
    level: { topic: home/office/co2, path: ppm }`,
    devices: [dev('co2', 'Office CO2', { co2: 'clear', level: 640 })],
  },
  {
    kind: 'air_quality',
    title: 'Air Quality',
    blurb: 'HomeKit scale 1 (excellent) – 5 (poor), optional PM2.5 density.',
    gets: [['quality', '1–5'], ['pm25', 'µg/m³ (optional)']],
    sets: [],
    yaml: `- name: Living Room Air
  type: air_quality
  get:
    quality: { topic: home/air/quality }
    pm25: { topic: home/air/pm25 }`,
    devices: [dev('air_quality', 'Living Room Air', { quality: 2, pm25: 8 })],
  },
  {
    kind: 'light',
    title: 'Light Sensor',
    blurb: 'Ambient light level in lux.',
    gets: [['lux', 'lux']],
    sets: [],
    yaml: `- name: Garden Brightness
  type: light
  get:
    lux: { topic: garden/weather, path: illuminance }`,
    devices: [dev('light', 'Garden Brightness', { lux: 5230 })],
  },
  {
    kind: 'switch',
    title: 'Switch / Outlet',
    blurb: 'On/off with separate state and command topics (types: switch, outlet).',
    gets: [['on', 'boolean'], ['battery', '% (optional)']],
    sets: ['on'],
    yaml: `- name: Desk Lamp
  type: switch
  get:
    "on": { topic: lamp/state, "on": "ON", "off": "OFF" }
  set:
    "on": { topic: lamp/set, "on": "ON", "off": "OFF" }`,
    devices: [dev('switch', 'Desk Lamp', { on: true }, ['on'])],
  },
  {
    kind: 'lightbulb',
    title: 'Light',
    blurb: 'Dimmable and colored lights: brightness, color temperature, hue, saturation.',
    gets: [['on', 'boolean'], ['brightness', '0–100'], ['color_temperature', 'mireds 140–500'], ['hue', '0–360°'], ['saturation', '0–100']],
    sets: ['on', 'brightness', 'color_temperature', 'hue', 'saturation'],
    yaml: `- name: Ceiling Light
  type: lightbulb
  get:
    "on": { topic: light/state, "on": "ON", "off": "OFF" }
    brightness: { topic: light/brightness/state }
    color_temperature: { topic: light/ct/state }
  set:
    "on": { topic: light/set, "on": "ON", "off": "OFF" }
    brightness: { topic: light/brightness/set }
    color_temperature: { topic: light/ct/set }`,
    devices: [dev('lightbulb', 'Ceiling Light', { on: true, brightness: 70, color_temperature: 320 }, ['on', 'brightness', 'color_temperature'])],
  },
  {
    kind: 'window_covering',
    title: 'Window Covering',
    blurb: 'Position 0–100 with open/close shortcuts and optional venetian tilt (types: window_covering, blind, shade).',
    gets: [['position', '0–100'], ['tilt', '−90–90° (optional)']],
    sets: ['position', 'tilt'],
    yaml: `- name: Living Room Blind
  type: window_covering
  get:
    position: { topic: shelly/blind/status, path: current_pos }
    tilt: { topic: shelly/blind/status, path: slat_pos, factor: 1.8, offset: -90 }
  set:
    position: { topic: shelly/blind/command, template: "pos,{{value}}" }
    tilt: { topic: shelly/blind/command, factor: 0.5555555556, offset: 50, round: true, template: "slat_pos,{{value}}" }`,
    devices: [dev('window_covering', 'Living Room Blind', { position: 65, tilt: 0 }, ['position', 'tilt'])],
  },
  {
    kind: 'door',
    title: 'Door / Window',
    blurb: 'Motorized door or window with position control (types: door, window).',
    gets: [['position', '0–100']],
    sets: ['position'],
    yaml: `- name: Skylight
  type: window
  get:
    position: { topic: home/skylight/position }
  set:
    position: { topic: home/skylight/set }`,
    devices: [dev('window', 'Skylight', { position: 30 }, ['position'])],
  },
  {
    kind: 'garage_door',
    title: 'Garage Door',
    blurb: 'Open/close with optional obstruction detection.',
    gets: [['open', 'boolean'], ['obstruction', 'boolean (optional)']],
    sets: ['open'],
    yaml: `- name: Garage
  type: garage_door
  get:
    open: { topic: garage/door/state, "on": "open", "off": "closed" }
    obstruction: { topic: garage/door/obstruction }
  set:
    open: { topic: garage/door/set, "on": "open", "off": "close" }`,
    devices: [dev('garage_door', 'Garage', { open: 'open' }, ['open'])],
  },
  {
    kind: 'thermostat',
    title: 'Thermostat',
    blurb: 'Current/target temperature plus heating mode (types: thermostat, radiator).',
    gets: [['current_temperature', '°C'], ['target_temperature', '°C'], ['mode', 'off/heat/cool/auto'], ['battery', '% (optional)']],
    sets: ['target_temperature', 'mode'],
    yaml: `- name: Office Radiator
  type: thermostat
  get:
    current_temperature: { topic: zigbee2mqtt/office-trv, path: local_temperature }
    target_temperature: { topic: zigbee2mqtt/office-trv, path: occupied_heating_setpoint }
    mode: { topic: zigbee2mqtt/office-trv, path: system_mode }
  set:
    target_temperature: { topic: zigbee2mqtt/office-trv/set, template: '{"occupied_heating_setpoint":{{value}}}' }
    mode: { topic: zigbee2mqtt/office-trv/set, template: '{"system_mode":"{{value}}"}' }`,
    devices: [dev('thermostat', 'Office Radiator', { current_temperature: 20.4, target_temperature: 22, mode: 'heat', battery: 61 }, ['target_temperature', 'mode'])],
  },
  {
    kind: 'fan',
    title: 'Fan',
    blurb: 'On/off with optional rotation speed.',
    gets: [['on', 'boolean'], ['speed', '0–100 (optional)']],
    sets: ['on', 'speed'],
    yaml: `- name: Ceiling Fan
  type: fan
  get:
    "on": { topic: fan/state, "on": "ON", "off": "OFF" }
    speed: { topic: fan/speed/state }
  set:
    "on": { topic: fan/set, "on": "ON", "off": "OFF" }
    speed: { topic: fan/speed/set }`,
    devices: [dev('fan', 'Ceiling Fan', { on: true, speed: 40 }, ['on', 'speed'])],
  },
  {
    kind: 'lock',
    title: 'Lock',
    blurb: 'Lock mechanism; unlocked state lifts the card.',
    gets: [['locked', 'boolean']],
    sets: ['locked'],
    yaml: `- name: Front Door Lock
  type: lock
  get:
    locked: { topic: nuki/front/state, path: locked }
  set:
    locked: { topic: nuki/front/set, "on": "lock", "off": "unlock" }`,
    devices: [dev('lock', 'Front Door Lock', { locked: true }, ['locked'])],
  },
  {
    kind: 'valve',
    title: 'Valve',
    blurb: 'Irrigation or water valve — open/close.',
    gets: [['on', 'boolean']],
    sets: ['on'],
    yaml: `- name: Garden Irrigation
  type: valve
  get:
    "on": { topic: garden/valve/state }
  set:
    "on": { topic: garden/valve/set }`,
    devices: [dev('valve', 'Garden Irrigation', { on: false }, ['on'])],
  },
  {
    kind: 'button',
    title: 'Button',
    blurb: 'Stateless programmable switch: single/double/long press events for HomeKit automations. Payload match filters pick the right events; the extracted value selects the button.',
    gets: [['single', 'button index'], ['double', 'button index'], ['long', 'button index']],
    sets: [],
    yaml: `- name: Terrace Button
  type: button
  buttons: 2
  get:
    single: { topic: hue/button/terrace, match: { event: short_release }, path: button }
    long: { topic: hue/button/terrace, match: { event: long_release }, path: button }`,
    devices: [dev('button', 'Terrace Button', { last_button: 1, last_event: 'single' })],
  },
  {
    kind: 'doorbell',
    title: 'Doorbell',
    blurb: 'Rings a HomeKit notification on every press.',
    gets: [['single', 'ring'], ['double', 'ring'], ['long', 'ring']],
    sets: [],
    yaml: `- name: Front Doorbell
  type: doorbell
  get:
    single: { topic: home/doorbell/pressed }`,
    devices: [dev('doorbell', 'Front Doorbell', { last_event: 'ring' })],
  },
  {
    kind: 'security_system',
    title: 'Security System',
    blurb: 'Armed states off/home/away/night; "triggered" raises the HomeKit alarm.',
    gets: [['state', 'off/home/away/night/triggered']],
    sets: ['state'],
    yaml: `- name: Alarm
  type: security_system
  get:
    state: { topic: alarm/state }
  set:
    state: { topic: alarm/set }`,
    devices: [dev('security_system', 'Alarm', { state: 'home' }, ['state'])],
  },
];
