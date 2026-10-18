import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type Lang = 'de' | 'en'
export const LANGS: Lang[] = ['de', 'en']

const LANG_KEY = 'home.lang'

// German is the house language; English stays one tap away. Per device.
function initialLang(fallback: Lang): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'de' || v === 'en') return v
  } catch {
    // storage blocked
  }
  return fallback
}

const dict = {
  de: {
    title: 'HomeKit',
    language: 'Sprache',
    connected: 'Verbunden',
    disconnected: 'Keine Verbindung',
    healthy: 'Bridge erreichbar',
    unhealthy: 'Bridge gestört',
    refresh: 'Aktualisieren',
    retry: 'Erneut verbinden',
    'pairing.show': 'Kopplungscode anzeigen',
    'pairing.hide': 'Kopplungscode ausblenden',
    'pairing.title': 'Kopplungscode',
    'pairing.hint': 'In der Home-App scannen oder den Code eingeben.',
    'pairing.qr': 'HomeKit-Kopplungscode als QR-Code',
    'pairing.count': '{n} Geräte an der Bridge',
    'pairing.count1': '1 Gerät an der Bridge',
    loading: 'Zubehör wird geladen …',
    'empty.all': 'Kein Zubehör gefunden.',
    'empty.category': 'Kein Zubehör in dieser Kategorie.',
    'room.other': 'Ohne Raum',
    'err.parse': 'Daten vom Server konnten nicht gelesen werden.',
    'err.closed': 'Der Server hat die Verbindung beendet.',
    'err.connection': 'Verbindungsfehler.',
    'err.connect': 'Verbindung zum Server fehlgeschlagen.',
    filter: 'Nach Gerätetyp filtern',
    'cat.all': 'Alle',
    'cat.sensors': 'Sensoren',
    'cat.switches': 'Schalter',
    'cat.outlets': 'Steckdosen',
    'cat.lights': 'Licht',
    'cat.covers': 'Beschattung',
    'cat.climate': 'Klima',
    'cat.security': 'Sicherheit',
    batteries: 'Batterien',
    'batteries.count': '{n} Geräte',
    'batteries.low': '{n} schwach',
    waiting: 'wartet auf Daten',
    'waiting.short': 'Warte …',
    on: 'An',
    off: 'Aus',
    open: 'Offen',
    closed: 'Geschlossen',
    'action.open': 'Öffnen',
    'action.close': 'Schließen',
    onOff: '{name} ein/aus',
    detected: 'Bewegung',
    clear: 'Ruhig',
    occupied: 'Anwesend',
    vacant: 'Frei',
    leak: 'Wasser erkannt!',
    dry: 'Trocken',
    smoke: 'Rauch!',
    noSmoke: 'Kein Rauch',
    gasDetected: 'Erkannt!',
    ok: 'OK',
    unknown: 'Unbekannt',
    'aq.0': 'Unbekannt',
    'aq.1': 'Ausgezeichnet',
    'aq.2': 'Gut',
    'aq.3': 'Mittel',
    'aq.4': 'Schlecht',
    'aq.5': 'Sehr schlecht',
    locked: 'Verriegelt',
    unlocked: 'Entriegelt',
    alarm: 'ALARM',
    mode: 'Modus',
    'mode.off': 'Aus',
    'mode.heat': 'Heizen',
    'mode.auto': 'Auto',
    'mode.home': 'Zuhause',
    'mode.away': 'Abwesend',
    'mode.night': 'Nacht',
    'mode.triggered': 'Ausgelöst',
    target: 'Soll',
    'target.down': 'Solltemperatur senken',
    'target.up': 'Solltemperatur erhöhen',
    speed: 'Drehzahl',
    brightness: 'Helligkeit',
    warmth: 'Farbtemperatur',
    hue: 'Farbton',
    saturation: 'Sättigung',
    position: 'Position',
    tilt: 'Neigung',
    'tilt.value': 'Neigung {v}°',
    'button.event': 'Taste {n} · {event}',
    'button.none': 'Noch nicht gedrückt',
    'doorbell.none': 'Noch nicht geklingelt',
    obstructed: 'Blockiert',
    identify: 'Identifizieren',
    'kind.temperature': 'Temperatur',
    'kind.humidity': 'Luftfeuchte',
    'kind.temperature_humidity': 'Temperatur & Luftfeuchte',
    'kind.contact': 'Kontaktsensor',
    'kind.motion': 'Bewegungsmelder',
    'kind.switch': 'Schalter',
    'kind.outlet': 'Steckdose',
    'kind.lightbulb': 'Licht',
    'kind.window_covering': 'Rollladen',
    'kind.blind': 'Rollladen',
    'kind.shade': 'Rollladen',
    'kind.thermostat': 'Thermostat',
    'kind.radiator': 'Thermostat',
    'kind.button': 'Taster',
    'kind.occupancy': 'Präsenzmelder',
    'kind.leak': 'Wassermelder',
    'kind.smoke': 'Rauchmelder',
    'kind.co': 'CO-Melder',
    'kind.co2': 'CO₂-Sensor',
    'kind.air_quality': 'Luftqualität',
    'kind.light': 'Lichtsensor',
    'kind.fan': 'Ventilator',
    'kind.lock': 'Schloss',
    'kind.garage_door': 'Garagentor',
    'kind.door': 'Tür',
    'kind.window': 'Fenster',
    'kind.valve': 'Ventil',
    'kind.doorbell': 'Türklingel',
    'kind.security_system': 'Alarmanlage',
  },
  en: {
    title: 'HomeKit',
    language: 'Language',
    connected: 'Connected',
    disconnected: 'Disconnected',
    healthy: 'Bridge reachable',
    unhealthy: 'Bridge unhealthy',
    refresh: 'Refresh',
    retry: 'Reconnect',
    'pairing.show': 'Show pairing code',
    'pairing.hide': 'Hide pairing code',
    'pairing.title': 'Pairing code',
    'pairing.hint': 'Scan or enter the code in the Home app.',
    'pairing.qr': 'HomeKit pairing QR code',
    'pairing.count': '{n} accessories on the bridge',
    'pairing.count1': '1 accessory on the bridge',
    loading: 'Loading accessories …',
    'empty.all': 'No accessories found.',
    'empty.category': 'No accessories in this category.',
    'room.other': 'No room',
    'err.parse': 'Could not read the server data.',
    'err.closed': 'Connection closed by the server.',
    'err.connection': 'Connection error.',
    'err.connect': 'Could not connect to the server.',
    filter: 'Filter by accessory type',
    'cat.all': 'All',
    'cat.sensors': 'Sensors',
    'cat.switches': 'Switches',
    'cat.outlets': 'Outlets',
    'cat.lights': 'Lights',
    'cat.covers': 'Covers',
    'cat.climate': 'Climate',
    'cat.security': 'Security',
    batteries: 'Batteries',
    'batteries.count': '{n} devices',
    'batteries.low': '{n} low',
    waiting: 'waiting for data',
    'waiting.short': 'Waiting …',
    on: 'On',
    off: 'Off',
    open: 'Open',
    closed: 'Closed',
    'action.open': 'Open',
    'action.close': 'Close',
    onOff: '{name} on/off',
    detected: 'Motion',
    clear: 'Clear',
    occupied: 'Occupied',
    vacant: 'Vacant',
    leak: 'Leak!',
    dry: 'Dry',
    smoke: 'Smoke!',
    noSmoke: 'Clear',
    gasDetected: 'Detected!',
    ok: 'OK',
    unknown: 'Unknown',
    'aq.0': 'Unknown',
    'aq.1': 'Excellent',
    'aq.2': 'Good',
    'aq.3': 'Fair',
    'aq.4': 'Inferior',
    'aq.5': 'Poor',
    locked: 'Locked',
    unlocked: 'Unlocked',
    alarm: 'ALARM',
    mode: 'Mode',
    'mode.off': 'Off',
    'mode.heat': 'Heat',
    'mode.auto': 'Auto',
    'mode.home': 'Home',
    'mode.away': 'Away',
    'mode.night': 'Night',
    'mode.triggered': 'Triggered',
    target: 'Target',
    'target.down': 'Decrease target temperature',
    'target.up': 'Increase target temperature',
    speed: 'Speed',
    brightness: 'Brightness',
    warmth: 'Warmth',
    hue: 'Hue',
    saturation: 'Saturation',
    position: 'Position',
    tilt: 'Tilt',
    'tilt.value': 'tilt {v}°',
    'button.event': 'Button {n} · {event}',
    'button.none': 'No presses yet',
    'doorbell.none': 'No rings yet',
    obstructed: 'Obstructed',
    identify: 'Identify',
    'kind.temperature': 'Temperature',
    'kind.humidity': 'Humidity',
    'kind.temperature_humidity': 'Temperature & humidity',
    'kind.contact': 'Contact sensor',
    'kind.motion': 'Motion sensor',
    'kind.switch': 'Switch',
    'kind.outlet': 'Outlet',
    'kind.lightbulb': 'Light',
    'kind.window_covering': 'Window covering',
    'kind.blind': 'Window covering',
    'kind.shade': 'Window covering',
    'kind.thermostat': 'Thermostat',
    'kind.radiator': 'Thermostat',
    'kind.button': 'Button',
    'kind.occupancy': 'Occupancy sensor',
    'kind.leak': 'Leak sensor',
    'kind.smoke': 'Smoke sensor',
    'kind.co': 'CO sensor',
    'kind.co2': 'CO₂ sensor',
    'kind.air_quality': 'Air quality',
    'kind.light': 'Light sensor',
    'kind.fan': 'Fan',
    'kind.lock': 'Lock',
    'kind.garage_door': 'Garage door',
    'kind.door': 'Door',
    'kind.window': 'Window',
    'kind.valve': 'Valve',
    'kind.doorbell': 'Doorbell',
    'kind.security_system': 'Security system',
  },
} satisfies Record<Lang, Record<string, string>>

export type Key = keyof (typeof dict)['de']

export interface I18n {
  lang: Lang
  locale: string
  setLang: (l: Lang) => void
  /** A UI string with {placeholders}. */
  t: (key: Key, vars?: Record<string, string | number>) => string
  /** A string for a dynamic key (kind, mode) or the fallback when there is none. */
  tx: (key: string, fallback: string) => string
  /** A number in the current locale (21,5 in German). */
  num: (n: number, decimals?: number) => string
  /** "21,5 °C" or "—" for a missing value. */
  temp: (v: unknown) => string
  /** "48 %" or "—" for a missing value. */
  pct: (v: unknown) => string
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children, fallback = 'de' }: { children: React.ReactNode; fallback?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang(fallback))

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      // convenience only
    }
  }, [])

  const value = useMemo<I18n>(() => {
    const locale = lang === 'de' ? 'de-DE' : 'en-GB'
    document.documentElement.lang = lang
    const fill = (s: string, vars?: Record<string, string | number>) =>
      s.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ''))
    const t: I18n['t'] = (key, vars) => fill(dict[lang][key] ?? dict.en[key] ?? key, vars)
    const tx: I18n['tx'] = (key, fallbackText) =>
      key in dict[lang] ? dict[lang][key as Key] : fallbackText
    const fmt = new Map<number, Intl.NumberFormat>()
    const num: I18n['num'] = (n, decimals = 0) => {
      let f = fmt.get(decimals)
      if (!f) {
        f = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        fmt.set(decimals, f)
      }
      return f.format(n)
    }
    const temp: I18n['temp'] = (v) => (typeof v === 'number' ? `${num(v, 1)} °C` : '—')
    const pct: I18n['pct'] = (v) => (typeof v === 'number' ? `${num(Math.round(v))} %` : '—')
    return { lang, locale, setLang, t, tx, num, temp, pct }
  }, [lang, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}

export function LangSwitch() {
  const i = useI18n()
  return (
    <div className="seg" role="group" aria-label={i.t('language')}>
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={i.lang === l} onClick={() => i.setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
