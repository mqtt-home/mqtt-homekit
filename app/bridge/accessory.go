package bridge

import (
	"fmt"
	"hash/fnv"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/brutella/hap/accessory"
	"github.com/brutella/hap/characteristic"
	"github.com/brutella/hap/service"
	"github.com/mqtt-home/mqtt-homekit/config"
)

// Device is a configured accessory: the HAP accessory plus a snapshot of its
// current characteristic values (for the web UI).
type Device struct {
	Name string
	Type string
	Room string
	AID  uint64

	a     *accessory.A
	mu    sync.Mutex
	state map[string]any
	// controls maps a writable characteristic name to its setter. Populated
	// during buildDevice only; read-only afterwards.
	controls map[string]func(any) error
}

func (d *Device) record(key string, v any) {
	d.mu.Lock()
	d.state[key] = v
	d.mu.Unlock()
}

// State returns a copy of the device's current values.
func (d *Device) State() map[string]any {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make(map[string]any, len(d.state))
	for k, v := range d.state {
		out[k] = v
	}
	return out
}

// Controls lists the writable characteristic names, sorted for stable output.
func (d *Device) Controls() []string {
	names := make([]string, 0, len(d.controls))
	for n := range d.controls {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}

// Control sets a writable characteristic: it publishes the value to MQTT and
// updates the HAP characteristic so paired HomeKit controllers are notified —
// the same effect as a write from the Home app.
func (d *Device) Control(name string, value any) error {
	fn, ok := d.controls[name]
	if !ok {
		return fmt.Errorf("characteristic %q of %q is not writable", name, d.Name)
	}
	return fn(value)
}

// lowBatteryThreshold is the level (percent) at or below which HomeKit's
// low-battery status is raised.
const lowBatteryThreshold = 20

// buildDevice constructs a HAP accessory of the configured type and wires its
// characteristics to MQTT.
func (b *Bridge) buildDevice(acc config.Accessory) (*Device, error) {
	if acc.Name == "" {
		return nil, fmt.Errorf("accessory without a name")
	}
	info := accessory.Info{
		Name:         acc.Name,
		Manufacturer: orDefault(acc.Manufacturer, "mqtt-homekit"),
		Model:        orDefault(acc.Model, acc.Type),
	}
	d := &Device{Name: acc.Name, Type: acc.Type, Room: acc.Room, state: map[string]any{}, controls: map[string]func(any) error{}}

	switch acc.Type {
	case "temperature":
		a := accessory.NewTemperatureSensor(info)
		widenTemp(a.TempSensor.CurrentTemperature)
		b.readFloat(d, "temperature", acc.Source("temperature"), func(v float64) {
			a.TempSensor.CurrentTemperature.SetValue(v)
		})
		d.a = a.A

	case "humidity":
		a := accessory.New(info, accessory.TypeSensor)
		hs := service.NewHumiditySensor()
		a.AddS(hs.S)
		b.readFloat(d, "humidity", acc.Source("humidity"), func(v float64) {
			hs.CurrentRelativeHumidity.SetValue(v)
		})
		d.a = a

	case "temperature_humidity":
		a := accessory.NewTemperatureSensor(info)
		widenTemp(a.TempSensor.CurrentTemperature)
		hs := service.NewHumiditySensor()
		a.AddS(hs.S)
		b.readFloat(d, "temperature", acc.Source("temperature"), func(v float64) {
			a.TempSensor.CurrentTemperature.SetValue(v)
		})
		b.readFloat(d, "humidity", acc.Source("humidity"), func(v float64) {
			hs.CurrentRelativeHumidity.SetValue(v)
		})
		d.a = a.A

	case "contact":
		a := accessory.NewContactSensor(info)
		b.readBoolLabeled(d, "contact", acc.Source("contact"), "open", "closed", func(open bool) {
			state := characteristic.ContactSensorStateContactDetected
			if open {
				state = characteristic.ContactSensorStateContactNotDetected
			}
			a.ContactSensor.ContactSensorState.SetValue(state)
		})
		d.a = a.A

	case "motion":
		a := accessory.NewMotionSensor(info)
		b.readBoolLabeled(d, "motion", acc.Source("motion"), "detected", "clear", func(v bool) {
			a.MotionSensor.MotionDetected.SetValue(v)
		})
		d.a = a.A

	case "switch":
		a := accessory.NewSwitch(info)
		b.readBool(d, "on", acc.Source("on"), func(v bool) { a.Switch.On.SetValue(v) })
		if sink, ok := acc.Sink("on"); ok {
			b.writeBool(d, "on", sink, a.Switch.On.Bool)
		}
		d.a = a.A

	case "outlet":
		a := accessory.NewOutlet(info)
		a.Outlet.OutletInUse.SetValue(true)
		b.readBool(d, "on", acc.Source("on"), func(v bool) { a.Outlet.On.SetValue(v) })
		if sink, ok := acc.Sink("on"); ok {
			b.writeBool(d, "on", sink, a.Outlet.On.Bool)
		}
		d.a = a.A

	case "lightbulb":
		a := accessory.NewLightbulb(info)
		b.readBool(d, "on", acc.Source("on"), func(v bool) { a.Lightbulb.On.SetValue(v) })
		if sink, ok := acc.Sink("on"); ok {
			b.writeBool(d, "on", sink, a.Lightbulb.On.Bool)
		}
		if hasChar(acc, "brightness") {
			br := characteristic.NewBrightness()
			a.Lightbulb.AddC(br.C)
			b.readInt(d, "brightness", acc.Source("brightness"), func(v int) { br.SetValue(v) })
			if sink, ok := acc.Sink("brightness"); ok {
				b.writeInt(d, "brightness", sink, br.Int)
			}
		}
		d.a = a.A

	case "window_covering", "blind", "shade":
		a := accessory.NewWindowCovering(info)
		wc := a.WindowCovering
		b.readInt(d, "position", acc.Source("position"), func(v int) {
			wc.CurrentPosition.SetValue(v)
			wc.TargetPosition.SetValue(v)
			wc.PositionState.SetValue(characteristic.PositionStateStopped)
		})
		if sink, ok := acc.Sink("position"); ok {
			b.writeInt(d, "position", sink, wc.TargetPosition.Int)
		}
		// Optional slat/tilt support (HomeKit horizontal tilt, -90..90).
		if hasChar(acc, "tilt") {
			cur := characteristic.NewCurrentHorizontalTiltAngle()
			tgt := characteristic.NewTargetHorizontalTiltAngle()
			wc.AddC(cur.C)
			wc.AddC(tgt.C)
			b.readInt(d, "tilt", acc.Source("tilt"), func(v int) {
				cur.SetValue(v)
				tgt.SetValue(v)
			})
			if sink, ok := acc.Sink("tilt"); ok {
				b.writeInt(d, "tilt", sink, tgt.Int)
			}
		}
		d.a = a.A

	case "thermostat", "radiator":
		a := accessory.NewThermostat(info)
		t := a.Thermostat
		widenTemp(t.CurrentTemperature)
		t.TargetTemperature.SetMinValue(5)
		t.TargetTemperature.SetMaxValue(35)
		t.TargetHeatingCoolingState.SetValue(characteristic.TargetHeatingCoolingStateHeat)
		t.CurrentHeatingCoolingState.SetValue(characteristic.CurrentHeatingCoolingStateHeat)
		b.readFloat(d, "current_temperature", acc.Source("current_temperature"), func(v float64) {
			t.CurrentTemperature.SetValue(v)
		})
		b.readFloat(d, "target_temperature", acc.Source("target_temperature"), func(v float64) {
			t.TargetTemperature.SetValue(v)
		})
		if sink, ok := acc.Sink("target_temperature"); ok {
			b.writeFloat(d, "target_temperature", sink, t.TargetTemperature.Float)
		}
		// Optional heating mode (e.g. zigbee2mqtt system_mode: "off"/"heat"/"auto").
		if hasChar(acc, "mode") {
			b.readMode(d, acc.Source("mode"), t)
			if sink, ok := acc.Sink("mode"); ok {
				b.writeMode(d, sink, t)
			}
		}
		d.a = a.A

	default:
		return nil, fmt.Errorf("unknown accessory type %q (accessory %q)", acc.Type, acc.Name)
	}

	// Optional battery service for battery-powered devices (any type). The
	// level is mirrored to HomeKit's low-battery status flag.
	if hasChar(acc, "battery") {
		bs := service.NewBatteryService()
		d.a.AddS(bs.S)
		bs.ChargingState.SetValue(characteristic.ChargingStateNotChargeable)
		b.readInt(d, "battery", acc.Source("battery"), func(v int) {
			bs.BatteryLevel.SetValue(v)
			low := characteristic.StatusLowBatteryBatteryLevelNormal
			if v <= lowBatteryThreshold {
				low = characteristic.StatusLowBatteryBatteryLevelLow
			}
			bs.StatusLowBattery.SetValue(low)
		})
	}

	d.a.Id = b.stableAID(acc.Name)
	d.AID = d.a.Id
	return d, nil
}

// --- characteristic wiring helpers ---

func (b *Bridge) readBool(d *Device, name string, src config.ValueSource, apply func(bool)) {
	if src.Topic == "" {
		return
	}
	b.subscribe(src.Topic, func(payload []byte) {
		if !matchesFilter(src, payload) {
			return
		}
		v := parseBool(src, extract(payload, src.Path))
		apply(v)
		d.record(name, v)
		b.broadcast(d)
	})
}

// readBoolLabeled is readBool but records a human-readable state (e.g.
// "open"/"closed") instead of a bare on/off, for clearer sensor display.
func (b *Bridge) readBoolLabeled(d *Device, name string, src config.ValueSource, trueLabel, falseLabel string, apply func(bool)) {
	if src.Topic == "" {
		return
	}
	b.subscribe(src.Topic, func(payload []byte) {
		if !matchesFilter(src, payload) {
			return
		}
		v := parseBool(src, extract(payload, src.Path))
		apply(v)
		if v {
			d.record(name, trueLabel)
		} else {
			d.record(name, falseLabel)
		}
		b.broadcast(d)
	})
}

func (b *Bridge) readFloat(d *Device, name string, src config.ValueSource, apply func(float64)) {
	if src.Topic == "" {
		return
	}
	b.subscribe(src.Topic, func(payload []byte) {
		if !matchesFilter(src, payload) {
			return
		}
		if v, ok := parseFloat(src, extract(payload, src.Path)); ok {
			apply(v)
			d.record(name, v)
			b.broadcast(d)
		}
	})
}

func (b *Bridge) readInt(d *Device, name string, src config.ValueSource, apply func(int)) {
	b.readFloat(d, name, src, func(v float64) { apply(int(math.Round(v))) })
}

func (b *Bridge) writeBool(d *Device, name string, sink config.ValueSink, c *characteristic.Bool) {
	apply := func(v bool) {
		b.publish(sink.Topic, boolPayload(sink, v), sink.Retain)
		d.record(name, v)
		b.broadcast(d)
	}
	c.OnValueRemoteUpdate(apply)
	// Web-initiated writes additionally update the HAP characteristic so
	// HomeKit controllers are notified (SetValue does not re-trigger the
	// remote-update callback, so this cannot loop).
	d.controls[name] = func(raw any) error {
		v, ok := raw.(bool)
		if !ok {
			return fmt.Errorf("%s expects a boolean value", name)
		}
		c.SetValue(v)
		apply(v)
		return nil
	}
}

func (b *Bridge) writeInt(d *Device, name string, sink config.ValueSink, c *characteristic.Int) {
	apply := func(v int) {
		b.publish(sink.Topic, numberPayload(sink, float64(v)), sink.Retain)
		d.record(name, v)
		b.broadcast(d)
	}
	c.OnValueRemoteUpdate(apply)
	d.controls[name] = func(raw any) error {
		f, ok := toFloat(raw)
		if !ok {
			return fmt.Errorf("%s expects a numeric value", name)
		}
		if err := c.SetValue(int(math.Round(f))); err != nil {
			return err
		}
		// Publish the value HAP actually stored (SetValue clamps to the
		// characteristic's min/max), keeping MQTT and HomeKit in sync.
		apply(c.Value())
		return nil
	}
}

func (b *Bridge) writeFloat(d *Device, name string, sink config.ValueSink, c *characteristic.Float) {
	apply := func(v float64) {
		b.publish(sink.Topic, numberPayload(sink, v), sink.Retain)
		d.record(name, v)
		b.broadcast(d)
	}
	c.OnValueRemoteUpdate(apply)
	d.controls[name] = func(raw any) error {
		v, ok := toFloat(raw)
		if !ok {
			return fmt.Errorf("%s expects a numeric value", name)
		}
		// SetValue clamps to the characteristic's min/max; publish the value
		// HAP actually stored, keeping MQTT and HomeKit in sync.
		c.SetValue(v)
		apply(c.Value())
		return nil
	}
}

// readMode maps an MQTT mode payload ("off"/"heat"/"cool"/"auto") onto the
// thermostat's target and current heating/cooling states.
func (b *Bridge) readMode(d *Device, src config.ValueSource, t *service.Thermostat) {
	if src.Topic == "" {
		return
	}
	b.subscribe(src.Topic, func(payload []byte) {
		if !matchesFilter(src, payload) {
			return
		}
		v, ok := modeToState(extract(payload, src.Path))
		if !ok {
			return
		}
		t.TargetHeatingCoolingState.SetValue(v)
		t.CurrentHeatingCoolingState.SetValue(currentStateFor(v))
		d.record("mode", stateToMode(v))
		b.broadcast(d)
	})
}

// writeMode publishes HomeKit heating-mode changes to MQTT as a mode string
// and exposes the "mode" web control.
func (b *Bridge) writeMode(d *Device, sink config.ValueSink, t *service.Thermostat) {
	apply := func(v int) {
		b.publish(sink.Topic, stringPayload(sink, stateToMode(v)), sink.Retain)
		t.CurrentHeatingCoolingState.SetValue(currentStateFor(v))
		d.record("mode", stateToMode(v))
		b.broadcast(d)
	}
	t.TargetHeatingCoolingState.OnValueRemoteUpdate(apply)
	d.controls["mode"] = func(raw any) error {
		s, ok := raw.(string)
		if !ok {
			return fmt.Errorf("mode expects a string value (off, heat, cool, auto)")
		}
		v, ok := modeToState(s)
		if !ok {
			return fmt.Errorf("unknown mode %q (off, heat, cool, auto)", s)
		}
		if err := t.TargetHeatingCoolingState.SetValue(v); err != nil {
			return err
		}
		apply(v)
		return nil
	}
}

// modeToState maps a mode string to the HomeKit target heating/cooling state.
func modeToState(mode string) (int, bool) {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "off":
		return characteristic.TargetHeatingCoolingStateOff, true
	case "heat":
		return characteristic.TargetHeatingCoolingStateHeat, true
	case "cool":
		return characteristic.TargetHeatingCoolingStateCool, true
	case "auto":
		return characteristic.TargetHeatingCoolingStateAuto, true
	}
	return 0, false
}

func stateToMode(v int) string {
	switch v {
	case characteristic.TargetHeatingCoolingStateOff:
		return "off"
	case characteristic.TargetHeatingCoolingStateCool:
		return "cool"
	case characteristic.TargetHeatingCoolingStateAuto:
		return "auto"
	default:
		return "heat"
	}
}

// currentStateFor derives the current heating/cooling state from a target
// state (auto has no "current" equivalent; a heating-mode device reports heat).
func currentStateFor(target int) int {
	switch target {
	case characteristic.TargetHeatingCoolingStateOff:
		return characteristic.CurrentHeatingCoolingStateOff
	case characteristic.TargetHeatingCoolingStateCool:
		return characteristic.CurrentHeatingCoolingStateCool
	default:
		return characteristic.CurrentHeatingCoolingStateHeat
	}
}

// toFloat converts the JSON-decoded control value to a float64.
func toFloat(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	}
	return 0, false
}

// stableAID derives a stable accessory ID from the name so that reordering or
// adding accessories doesn't renumber existing ones (which would break their
// HomeKit pairing). AID 1 is reserved for the bridge.
func (b *Bridge) stableAID(name string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(name))
	id := h.Sum64()%1_000_000_000 + 2
	for b.usedAIDs[id] {
		id++
	}
	b.usedAIDs[id] = true
	return id
}

func widenTemp(c *characteristic.CurrentTemperature) {
	c.SetMinValue(-100)
	c.SetMaxValue(150)
}

func hasChar(acc config.Accessory, name string) bool {
	if _, ok := acc.Get[name]; ok {
		return true
	}
	_, ok := acc.Set[name]
	return ok
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
