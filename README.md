# mqtt-homekit

A lightweight **MQTT → HomeKit** bridge written in Go, using
[`brutella/hap`](https://github.com/brutella/hap) for the HomeKit Accessory
Protocol. It exposes MQTT-connected devices to Apple Home with a flexible,
config-driven mapping — a low-memory replacement for a Homebridge +
[mqttthing](https://github.com/arachnetech/homebridge-mqttthing) setup.

- Single static binary, ~single-digit/low-tens MB RSS (vs. ~200 MB for Node Homebridge)
- No plugin runtime — accessories are declared in a JSON or YAML config file
- Flexible mapping: per-characteristic topics, JSON path extraction, value/payload mapping, numeric scaling
- Built-in web dashboard: pairing QR code, live values via SSE, and full device
  control (switches, lights, covers, thermostats) grouped by room

## How it relates to Homebridge

Homebridge's value is its plugin ecosystem. If you only use it as an MQTT↔HomeKit
bridge (i.e. the `mqttthing` accessory), this replaces that use case in Go. It
does **not** run Homebridge plugins.

> **Migration note:** replacing a Homebridge bridge with this one is seen by the
> Home app as a *new* bridge — you re-scan the setup code and re-do room
> assignments, scenes and automations for the migrated accessories. After that
> it's stable. Accessory IDs are derived from the accessory `name`, so adding or
> reordering accessories later does not disturb existing pairings.

## Quick start

```bash
cd app
make dev      # builds and runs with ../production/config/config.yaml
```

Then in the Home app: **Add Accessory → More options →** pick the bridge and
enter the setup code (default `031-45-154`, shown on the web page at
`http://localhost:8080`).

### Docker

```bash
docker run -d --network host \
  -v /path/to/config:/var/lib/mqtt-homekit \
  pharndt/mqtt-homekit:latest
```

`--network host` (or a routable pod IP) is required: HomeKit uses mDNS/Bonjour
and direct TCP from your Apple devices to the bridge.

## Configuration

Both **YAML** (`.yaml`/`.yml`) and **JSON** config files are supported —
the format is chosen by file extension.

```yaml
mqtt:
  url: tcp://localhost:1883
  topic: homekit
  qos: 0
homekit:
  bridge_name: MQTT HomeKit
  pin: 031-45-154
  storage_dir: /data/hap
web:
  enabled: true
  port: 8080
accessories:
  - name: Desk Lamp
    type: switch
    room: Office
    get:
      "on": { topic: home/desk-lamp/state, "on": "ON", "off": "OFF" }
    set:
      "on": { topic: home/desk-lamp/set, "on": "ON", "off": "OFF" }
```

> **YAML note:** quote the `on` / `off` characteristic keys **and** payload
> values (`"on": "ON"`) — YAML parses bare `on`/`off`/`yes`/`no` as booleans.

`${VAR}` environment substitution is supported in the config file. See
[`production/config/config.example.yaml`](production/config/config.example.yaml)
for a worked example of every accessory type.

The optional `room` field groups accessories in the web dashboard. (HomeKit
rooms cannot be set by a bridge — the Home app stores room assignments on the
controller side, so rooms are assigned there manually.)

Go pprof profiling is available behind an opt-in flag (disabled by default;
only enable on trusted networks):

```yaml
pprof:
  enabled: true
  port: 6060 # default
  bind: 127.0.0.1 # optional: loopback only (kubectl port-forward); empty = all interfaces
```

> **Persistence:** `storage_dir` holds the HomeKit pairing keys. It **must**
> survive restarts (mount a writable volume in Kubernetes) — otherwise pairing
> is lost on every restart and you'll have to re-add the bridge. It must be
> writable by the runtime user, and **separate** from a read-only ConfigMap
> mount. Defaults to `<config-dir>/hap`.

### Accessory types

| `type` | HomeKit | Characteristics (mapping keys) |
|--------|---------|-------------------------------|
| `temperature` | Temperature sensor | `temperature` |
| `humidity` | Humidity sensor | `humidity` |
| `temperature_humidity` | Temp + humidity | `temperature`, `humidity` |
| `contact` | Contact sensor | `contact` (on = open) |
| `motion` | Motion sensor | `motion` |
| `switch` | Switch | `on` |
| `outlet` | Outlet | `on` |
| `lightbulb` | Lightbulb | `on`, optional `brightness` (0–100) |
| `window_covering` (`blind`, `shade`) | Window covering | `position` (0–100), optional `tilt` (−90–90°) |
| `thermostat` (`radiator`) | Thermostat | `current_temperature`, `target_temperature`, optional `mode` (`off`/`heat`/`cool`/`auto`) |
| `button` | Stateless programmable switch | `single`/`double`/`long` event sources; the extracted value is the button index (`buttons: N` for multi-button devices) |
| `occupancy` | Occupancy sensor | `occupancy` |
| `leak` | Leak sensor | `leak` |
| `smoke` | Smoke sensor | `smoke` |
| `co` / `co2` | CO / CO₂ sensor | `co`/`co2` (detected), optional `level` |
| `air_quality` | Air quality sensor | `quality` (1–5), optional `pm25` |
| `light` | Light sensor | `lux` |
| `fan` | Fan | `on`, optional `speed` (0–100) |
| `lock` | Lock mechanism | `locked` |
| `garage_door` | Garage door opener | `open`, optional `obstruction` |
| `door` / `window` | Door / window | `position` (0–100) |
| `valve` | Valve | `on` |
| `doorbell` | Doorbell | `single`/`double`/`long` ring sources |
| `security_system` | Security system | `state` (`off`/`home`/`away`/`night`/`triggered`) |

`lightbulb` additionally supports `hue` (0–360), `saturation` (0–100) and
`color_temperature` (mireds 140–500) for colored lights.

A rendered example of every type, including its dashboard card, is on the
project page: <https://mqtt-home.github.io/mqtt-homekit/>. Not mapped (not a
natural fit for MQTT): cameras, televisions, speakers, air purifiers and
heater-cooler/humidifier appliances.

Every accessory type additionally supports an optional `battery`
characteristic (0–100). It adds a HomeKit battery service (low-battery status
at ≤ 20 %) and feeds the battery overview on the web dashboard.

### Mapping model

Each accessory has an optional base `topic`, plus `get` (MQTT → HomeKit) and
`set` (HomeKit → MQTT) maps keyed by the characteristic names above.

`get` entry (`ValueSource`):

| field | meaning |
|-------|---------|
| `topic` | topic to subscribe (falls back to the accessory `topic`) |
| `path` | dot-path into a JSON payload (e.g. `state.temperature`); omit for a plain payload |
| `match` | map of dot-path → expected value; the message is ignored unless **all** match (case-insensitive) |
| `on` / `off` | payload strings mapped to boolean true/false (case-insensitive) |
| `factor` / `offset` | numeric transform: `out = in*factor + offset` |

`set` entry (`ValueSink`):

| field | meaning |
|-------|---------|
| `topic` | topic to publish to (falls back to the accessory `topic`) |
| `on` / `off` | payloads sent for boolean true/false (default `true`/`false`) |
| `template` | numeric payload template; `{{value}}` is replaced (e.g. `{"pos":{{value}}}`) |
| `factor` / `offset` | numeric transform applied before formatting |
| `retain` | publish retained |

Examples:

```jsonc
// plain numeric payload
{ "name": "Temp", "type": "temperature", "topic": "home/temp" }

// value from JSON, custom open/closed tokens
{ "name": "Door", "type": "contact",
  "get": { "contact": { "topic": "zigbee/door", "path": "contact", "on": "true", "off": "false" } } }

// switch with separate state/command topics
{ "name": "Lamp", "type": "switch",
  "get": { "on": { "topic": "lamp/state", "on": "ON", "off": "OFF" } },
  "set": { "on": { "topic": "lamp/set",   "on": "ON", "off": "OFF" } } }

// blind position via JSON command
{ "name": "Blind", "type": "window_covering",
  "get": { "position": { "topic": "blind/state", "path": "current_pos" } },
  "set": { "position": { "topic": "blind/cmd", "template": "{\"pos\":{{value}}}" } } }

// stateless button pair as a switch: only short_release events are
// considered (press/hold messages on the same topic are ignored)
{ "name": "Terrace Light", "type": "switch",
  "get": { "on": { "topic": "hue/button/terrace",
                   "match": { "event": "short_release" },
                   "path": "button", "on": "1", "off": "2" } },
  "set": { "on": { "topic": "hue/button/terrace",
                   "on": "{\"button\":1,\"event\":\"short_release\"}",
                   "off": "{\"button\":2,\"event\":\"short_release\"}" } } }
```

## Web UI / API

`http://localhost:8080` is a live dashboard: pairing QR code and setup code,
accessories grouped by `room`, values updating via SSE — and full device
control. Switches and lights get toggles (plus a brightness slider), window
coverings get position/tilt sliders with open/close shortcuts, thermostats get
a target-temperature stepper and an off/heat/auto mode switch. Web controls
publish to MQTT and update HomeKit simultaneously, exactly like a change made
from the Home app.

| Endpoint | Description |
|----------|-------------|
| `GET /api/info` | bridge name, pin, accessory count, health |
| `GET /api/devices` | accessories with current values, rooms and writable characteristics |
| `POST /api/devices/{aid}/control` | set a writable characteristic: `{"name": "on", "value": true}` |
| `GET /api/events` | SSE stream of device state updates |
| `GET /api/qr` | pairing QR code (PNG) |
| `GET /api/health` | health check |
| `GET /api/livez` | liveness probe |

## Development

```bash
cd app
make help     # list targets
make test
make build
make docker
```
