package bridge

import (
	"fmt"
	"hash/fnv"
	"math"
	"net/http"
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
		// Optional color support: hue (0-360), saturation (0-100) and/or
		// color temperature (mireds, 140-500).
		if hasChar(acc, "hue") {
			h := characteristic.NewHue()
			a.Lightbulb.AddC(h.C)
			b.readFloat(d, "hue", acc.Source("hue"), func(v float64) { h.SetValue(v) })
			if sink, ok := acc.Sink("hue"); ok {
				b.writeFloat(d, "hue", sink, h.Float)
			}
		}
		if hasChar(acc, "saturation") {
			sat := characteristic.NewSaturation()
			a.Lightbulb.AddC(sat.C)
			b.readFloat(d, "saturation", acc.Source("saturation"), func(v float64) { sat.SetValue(v) })
			if sink, ok := acc.Sink("saturation"); ok {
				b.writeFloat(d, "saturation", sink, sat.Float)
			}
		}
		if hasChar(acc, "color_temperature") {
			ct := characteristic.NewColorTemperature()
			a.Lightbulb.AddC(ct.C)
			b.readInt(d, "color_temperature", acc.Source("color_temperature"), func(v int) { ct.SetValue(v) })
			if sink, ok := acc.Sink("color_temperature"); ok {
				b.writeInt(d, "color_temperature", sink, ct.Int)
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

	case "occupancy":
		a := accessory.New(info, accessory.TypeSensor)
		s := service.NewOccupancySensor()
		a.AddS(s.S)
		b.readBoolLabeled(d, "occupancy", acc.Source("occupancy"), "occupied", "vacant", func(v bool) {
			s.OccupancyDetected.SetValue(boolToInt(v))
		})
		d.a = a

	case "leak":
		a := accessory.New(info, accessory.TypeSensor)
		s := service.NewLeakSensor()
		a.AddS(s.S)
		b.readBoolLabeled(d, "leak", acc.Source("leak"), "leak", "dry", func(v bool) {
			s.LeakDetected.SetValue(boolToInt(v))
		})
		d.a = a

	case "smoke":
		a := accessory.New(info, accessory.TypeSensor)
		s := service.NewSmokeSensor()
		a.AddS(s.S)
		b.readBoolLabeled(d, "smoke", acc.Source("smoke"), "smoke", "clear", func(v bool) {
			s.SmokeDetected.SetValue(boolToInt(v))
		})
		d.a = a

	case "co", "co2":
		a := accessory.New(info, accessory.TypeSensor)
		var detected *characteristic.Int
		var level *characteristic.Float
		if acc.Type == "co" {
			s := service.NewCarbonMonoxideSensor()
			a.AddS(s.S)
			detected = s.CarbonMonoxideDetected.Int
			if hasChar(acc, "level") {
				l := characteristic.NewCarbonMonoxideLevel()
				s.AddC(l.C)
				level = l.Float
			}
		} else {
			s := service.NewCarbonDioxideSensor()
			a.AddS(s.S)
			detected = s.CarbonDioxideDetected.Int
			if hasChar(acc, "level") {
				l := characteristic.NewCarbonDioxideLevel()
				s.AddC(l.C)
				level = l.Float
			}
		}
		b.readBoolLabeled(d, acc.Type, acc.Source(acc.Type), "detected", "clear", func(v bool) {
			detected.SetValue(boolToInt(v))
		})
		if level != nil {
			b.readFloat(d, "level", acc.Source("level"), func(v float64) { level.SetValue(v) })
		}
		d.a = a

	case "air_quality":
		a := accessory.New(info, accessory.TypeSensor)
		s := service.NewAirQualitySensor()
		a.AddS(s.S)
		b.readInt(d, "quality", acc.Source("quality"), func(v int) {
			s.AirQuality.SetValue(min(max(v, characteristic.AirQualityUnknown), characteristic.AirQualityPoor))
		})
		if hasChar(acc, "pm25") {
			pm := characteristic.NewPM2_5Density()
			s.AddC(pm.C)
			b.readFloat(d, "pm25", acc.Source("pm25"), func(v float64) { pm.SetValue(v) })
		}
		d.a = a

	case "light":
		a := accessory.New(info, accessory.TypeSensor)
		s := service.NewLightSensor()
		a.AddS(s.S)
		b.readFloat(d, "lux", acc.Source("lux"), func(v float64) {
			s.CurrentAmbientLightLevel.SetValue(v)
		})
		d.a = a

	case "fan":
		a := accessory.New(info, accessory.TypeFan)
		f := service.NewFanV2()
		a.AddS(f.S)
		b.readBool(d, "on", acc.Source("on"), func(v bool) { f.Active.SetValue(boolToInt(v)) })
		if sink, ok := acc.Sink("on"); ok {
			b.writeIntBool(d, "on", sink, f.Active.Int, characteristic.ActiveActive, characteristic.ActiveInactive, nil)
		}
		if hasChar(acc, "speed") {
			sp := characteristic.NewRotationSpeed()
			f.AddC(sp.C)
			b.readFloat(d, "speed", acc.Source("speed"), func(v float64) { sp.SetValue(v) })
			if sink, ok := acc.Sink("speed"); ok {
				b.writeFloat(d, "speed", sink, sp.Float)
			}
		}
		d.a = a

	case "lock":
		a := accessory.New(info, accessory.TypeDoorLock)
		l := service.NewLockMechanism()
		a.AddS(l.S)
		b.readBoolLabeled(d, "locked", acc.Source("locked"), "locked", "unlocked", func(v bool) {
			state := characteristic.LockCurrentStateUnsecured
			if v {
				state = characteristic.LockCurrentStateSecured
			}
			l.LockCurrentState.SetValue(state)
			l.LockTargetState.SetValue(state)
		})
		if sink, ok := acc.Sink("locked"); ok {
			b.writeIntBool(d, "locked", sink, l.LockTargetState.Int,
				characteristic.LockCurrentStateSecured, characteristic.LockCurrentStateUnsecured,
				func(v bool) { l.LockCurrentState.SetValue(boolToInt(v)) })
		}
		d.a = a

	case "garage_door":
		a := accessory.New(info, accessory.TypeGarageDoorOpener)
		g := service.NewGarageDoorOpener()
		a.AddS(g.S)
		b.readBoolLabeled(d, "open", acc.Source("open"), "open", "closed", func(v bool) {
			state := characteristic.CurrentDoorStateClosed
			if v {
				state = characteristic.CurrentDoorStateOpen
			}
			g.CurrentDoorState.SetValue(state)
			g.TargetDoorState.SetValue(state)
		})
		if sink, ok := acc.Sink("open"); ok {
			// HomeKit door states are inverted booleans: open = 0, closed = 1.
			b.writeIntBool(d, "open", sink, g.TargetDoorState.Int,
				characteristic.CurrentDoorStateOpen, characteristic.CurrentDoorStateClosed,
				func(v bool) {
					state := characteristic.CurrentDoorStateClosed
					if v {
						state = characteristic.CurrentDoorStateOpen
					}
					g.CurrentDoorState.SetValue(state)
				})
		}
		if hasChar(acc, "obstruction") {
			b.readBoolLabeled(d, "obstruction", acc.Source("obstruction"), "obstructed", "clear", func(v bool) {
				g.ObstructionDetected.SetValue(v)
			})
		}
		d.a = a

	case "door", "window":
		var cur *characteristic.CurrentPosition
		var tgt *characteristic.TargetPosition
		var pos *characteristic.PositionState
		var a *accessory.A
		if acc.Type == "door" {
			ad := accessory.New(info, accessory.TypeDoor)
			s := service.NewDoor()
			ad.AddS(s.S)
			cur, tgt, pos, a = s.CurrentPosition, s.TargetPosition, s.PositionState, ad
		} else {
			aw := accessory.New(info, accessory.TypeWindow)
			s := service.NewWindow()
			aw.AddS(s.S)
			cur, tgt, pos, a = s.CurrentPosition, s.TargetPosition, s.PositionState, aw
		}
		b.readInt(d, "position", acc.Source("position"), func(v int) {
			cur.SetValue(v)
			tgt.SetValue(v)
			pos.SetValue(characteristic.PositionStateStopped)
		})
		if sink, ok := acc.Sink("position"); ok {
			b.writeInt(d, "position", sink, tgt.Int)
		}
		d.a = a

	case "valve":
		a := accessory.New(info, accessory.TypeFaucet)
		v := service.NewValve()
		a.AddS(v.S)
		v.ValveType.SetValue(0) // generic valve
		b.readBool(d, "on", acc.Source("on"), func(on bool) {
			v.Active.SetValue(boolToInt(on))
			v.InUse.SetValue(boolToInt(on))
		})
		if sink, ok := acc.Sink("on"); ok {
			b.writeIntBool(d, "on", sink, v.Active.Int, characteristic.ActiveActive, characteristic.ActiveInactive,
				func(on bool) { v.InUse.SetValue(boolToInt(on)) })
		}
		d.a = a

	case "doorbell":
		a := accessory.New(info, accessory.TypeVideoDoorbell)
		db := service.NewDoorbell()
		a.AddS(db.S)
		ring := func(event int, eventLabel string) func(int) {
			return func(int) {
				db.ProgrammableSwitchEvent.SetValue(event)
				d.record("last_event", eventLabel)
				b.broadcast(d)
			}
		}
		b.readButton(d, acc.Source("single"), ring(characteristic.ProgrammableSwitchEventSinglePress, "ring"))
		b.readButton(d, acc.Source("double"), ring(characteristic.ProgrammableSwitchEventDoublePress, "double ring"))
		b.readButton(d, acc.Source("long"), ring(characteristic.ProgrammableSwitchEventLongPress, "long ring"))
		d.a = a

	case "security_system":
		a := accessory.New(info, accessory.TypeSecuritySystem)
		s := service.NewSecuritySystem()
		a.AddS(s.S)
		applyState := func(v int) {
			s.SecuritySystemTargetState.SetValue(min(v, characteristic.SecuritySystemTargetStateDisarm))
			s.SecuritySystemCurrentState.SetValue(v)
			d.record("state", securityStateName(v))
			b.broadcast(d)
		}
		src := acc.Source("state")
		if src.Topic != "" {
			b.subscribe(src.Topic, func(payload []byte) {
				if !matchesFilter(src, payload) {
					return
				}
				if v, ok := securityStateValue(extract(payload, src.Path)); ok {
					applyState(v)
				}
			})
		}
		if sink, ok := acc.Sink("state"); ok {
			apply := func(v int) {
				b.publish(sink.Topic, stringPayload(sink, securityStateName(v)), sink.Retain)
				s.SecuritySystemCurrentState.SetValue(v)
				d.record("state", securityStateName(v))
				b.broadcast(d)
			}
			s.SecuritySystemTargetState.OnValueRemoteUpdate(apply)
			d.controls["state"] = func(raw any) error {
				str, ok := raw.(string)
				if !ok {
					return fmt.Errorf("state expects a string value (home, away, night, off)")
				}
				v, ok := securityStateValue(str)
				if !ok || v > characteristic.SecuritySystemTargetStateDisarm {
					return fmt.Errorf("unknown security state %q (home, away, night, off)", str)
				}
				if err := s.SecuritySystemTargetState.SetValue(v); err != nil {
					return err
				}
				apply(v)
				return nil
			}
		}
		d.a = a

	case "button":
		// Stateless programmable switch: one service per physical button.
		// Event sources ("single"/"double"/"long") extract the button index
		// from the payload; non-numeric or missing values mean button 1.
		a := accessory.New(info, accessory.TypeProgrammableSwitch)
		n := acc.Buttons
		if n <= 0 {
			n = 1
		}
		if n > 1 {
			label := service.NewServiceLabel()
			label.ServiceLabelNamespace.SetValue(characteristic.ServiceLabelNamespaceArabicNumerals)
			a.AddS(label.S)
		}
		switches := make([]*service.StatelessProgrammableSwitch, n)
		for i := range switches {
			sw := service.NewStatelessProgrammableSwitch()
			if n > 1 {
				idx := characteristic.NewServiceLabelIndex()
				idx.SetValue(i + 1)
				sw.AddC(idx.C)
			}
			a.AddS(sw.S)
			switches[i] = sw
		}
		fire := func(event int, eventLabel string) func(int) {
			return func(btn int) {
				if btn < 1 || btn > n {
					return
				}
				switches[btn-1].ProgrammableSwitchEvent.SetValue(event)
				d.record("last_button", btn)
				d.record("last_event", eventLabel)
				b.broadcast(d)
			}
		}
		b.readButton(d, acc.Source("single"), fire(characteristic.ProgrammableSwitchEventSinglePress, "single"))
		b.readButton(d, acc.Source("double"), fire(characteristic.ProgrammableSwitchEventDoublePress, "double"))
		b.readButton(d, acc.Source("long"), fire(characteristic.ProgrammableSwitchEventLongPress, "long"))
		d.a = a

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

	d.a.IdentifyFunc = func(*http.Request) { b.identify(d.Name, d.Room) }

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

// readButton fires with the button index extracted from a matching message;
// payloads without a numeric index address button 1.
func (b *Bridge) readButton(_ *Device, src config.ValueSource, fire func(int)) {
	if src.Topic == "" {
		return
	}
	b.subscribe(src.Topic, func(payload []byte) {
		if !matchesFilter(src, payload) {
			return
		}
		btn := 1
		if raw := extract(payload, src.Path); raw != "" {
			if f, ok := parseFloat(src, raw); ok {
				btn = int(math.Round(f))
			}
		}
		fire(btn)
	})
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

// writeIntBool wires a HomeKit int characteristic with boolean semantics
// (Active, LockTargetState, TargetDoorState, ...) to a boolean MQTT sink and
// web control. trueVal/falseVal are the characteristic values for on/off;
// mirror (optional) updates a paired current-state characteristic.
func (b *Bridge) writeIntBool(d *Device, name string, sink config.ValueSink, c *characteristic.Int, trueVal, falseVal int, mirror func(bool)) {
	apply := func(v bool) {
		b.publish(sink.Topic, boolPayload(sink, v), sink.Retain)
		if mirror != nil {
			mirror(v)
		}
		d.record(name, v)
		b.broadcast(d)
	}
	c.OnValueRemoteUpdate(func(iv int) { apply(iv == trueVal) })
	d.controls[name] = func(raw any) error {
		v, ok := raw.(bool)
		if !ok {
			return fmt.Errorf("%s expects a boolean value", name)
		}
		val := falseVal
		if v {
			val = trueVal
		}
		if err := c.SetValue(val); err != nil {
			return err
		}
		apply(v)
		return nil
	}
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

// securityStateValue maps a payload string to a HomeKit security-system state.
func securityStateValue(s string) (int, bool) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "home", "stay":
		return characteristic.SecuritySystemCurrentStateStayArm, true
	case "away":
		return characteristic.SecuritySystemCurrentStateAwayArm, true
	case "night":
		return characteristic.SecuritySystemCurrentStateNightArm, true
	case "off", "disarm", "disarmed":
		return characteristic.SecuritySystemCurrentStateDisarmed, true
	case "triggered", "alarm":
		return characteristic.SecuritySystemCurrentStateAlarmTriggered, true
	}
	return 0, false
}

func securityStateName(v int) string {
	switch v {
	case characteristic.SecuritySystemCurrentStateStayArm:
		return "home"
	case characteristic.SecuritySystemCurrentStateAwayArm:
		return "away"
	case characteristic.SecuritySystemCurrentStateNightArm:
		return "night"
	case characteristic.SecuritySystemCurrentStateAlarmTriggered:
		return "triggered"
	default:
		return "off"
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
