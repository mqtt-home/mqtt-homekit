package bridge

import (
	"fmt"
	"hash/fnv"
	"math"
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
	AID  uint64

	a     *accessory.A
	mu    sync.Mutex
	state map[string]any
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
	d := &Device{Name: acc.Name, Type: acc.Type, state: map[string]any{}}

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
		d.a = a.A

	default:
		return nil, fmt.Errorf("unknown accessory type %q (accessory %q)", acc.Type, acc.Name)
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
	c.OnValueRemoteUpdate(func(v bool) {
		b.publish(sink.Topic, boolPayload(sink, v), sink.Retain)
		d.record(name, v)
		b.broadcast(d)
	})
}

func (b *Bridge) writeInt(d *Device, name string, sink config.ValueSink, c *characteristic.Int) {
	c.OnValueRemoteUpdate(func(v int) {
		b.publish(sink.Topic, numberPayload(sink, float64(v)), sink.Retain)
		d.record(name, v)
		b.broadcast(d)
	})
}

func (b *Bridge) writeFloat(d *Device, name string, sink config.ValueSink, c *characteristic.Float) {
	c.OnValueRemoteUpdate(func(v float64) {
		b.publish(sink.Topic, numberPayload(sink, v), sink.Retain)
		d.record(name, v)
		b.broadcast(d)
	})
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
