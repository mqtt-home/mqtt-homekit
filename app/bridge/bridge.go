package bridge

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	dlog "github.com/brutella/dnssd/log"
	"github.com/brutella/hap"
	"github.com/brutella/hap/accessory"
	hlog "github.com/brutella/hap/log"
	"github.com/mqtt-home/mqtt-homekit/config"
	"github.com/mqtt-home/mqtt-homekit/version"
	"github.com/philipparndt/go-logger"
	"github.com/philipparndt/mqtt-gateway/mqtt"
)

// categoryBridge is the HomeKit accessory category for a bridge.
const categoryBridge = 2

// Bridge maps MQTT topics to a HomeKit bridge accessory using brutella/hap.
type Bridge struct {
	cfg       config.Config
	server    *hap.Server
	bridgeAcc *accessory.Bridge
	devices   []*Device
	usedAIDs  map[uint64]bool
	cancel    context.CancelFunc
	done      chan struct{} // closed when the HAP server has fully stopped
	started   bool

	onUpdate func(*Device)
}

func New(cfg config.Config) *Bridge {
	return &Bridge{
		cfg:      cfg,
		usedAIDs: map[uint64]bool{1: true}, // AID 1 is the bridge
	}
}

// SetUpdateListener registers a callback fired whenever a device value changes
// (used by the web UI).
func (b *Bridge) SetUpdateListener(fn func(*Device)) { b.onUpdate = fn }

func (b *Bridge) Devices() []*Device { return b.devices }
func (b *Bridge) BridgeName() string { return b.cfg.HomeKit.BridgeName }
func (b *Bridge) Pin() string        { return b.cfg.HomeKit.Pin }
func (b *Bridge) SetupID() string    { return b.cfg.HomeKit.SetupID }
func (b *Bridge) Healthy() bool      { return b.started }

// SetupURI returns the X-HM:// pairing payload encoded in the HomeKit QR code.
func (b *Bridge) SetupURI() string {
	return setupURI(b.cfg.HomeKit.Pin, categoryBridge, b.cfg.HomeKit.SetupID)
}

func (b *Bridge) subscribe(topic string, cb func([]byte)) {
	if topic == "" {
		return
	}
	mqtt.Subscribe(topic, func(_ string, payload []byte) { cb(payload) })
}

func (b *Bridge) publish(topic, payload string, retain bool) {
	if topic == "" {
		logger.Warn("Skipping publish: no topic configured")
		return
	}
	mqtt.PublishAbsolute(topic, payload, retain)
}

func (b *Bridge) broadcast(d *Device) {
	if b.onUpdate != nil {
		b.onUpdate(d)
	}
}

// hapLogWriter routes brutella/hap's logger through go-logger so library
// messages share the application's log format and level.
type hapLogWriter struct{}

func (hapLogWriter) Write(p []byte) (int, error) {
	logger.Debug(strings.TrimRight(string(p), "\n"), "component", "hap")
	return len(p), nil
}

// routeHAPLogging strips brutella's own prefix/timestamp and forwards its Info
// output to go-logger. brutella's Debug logger is left disabled (it's very
// chatty HAP-protocol output) so this only relays the library's notable lines.
func routeHAPLogging() {
	hlog.Info.SetFlags(0)
	hlog.Info.SetPrefix("")
	hlog.Info.SetOutput(hapLogWriter{})

	// dnssd has its own logger (e.g. the "unable to wait for link updates" line).
	dlog.Info.SetFlags(0)
	dlog.Info.SetPrefix("")
	dlog.Info.SetOutput(hapLogWriter{})
}

// Start connects to MQTT, builds the accessories and starts the HAP server.
func (b *Bridge) Start() error {
	routeHAPLogging()
	mqtt.Start(b.cfg.MQTT, "mqtt_homekit")

	var accs []*accessory.A
	for _, ac := range b.cfg.Accessories {
		d, err := b.buildDevice(ac)
		if err != nil {
			logger.Error("Skipping accessory", "error", err)
			continue
		}
		b.devices = append(b.devices, d)
		accs = append(accs, d.a)
		logger.Debug("Configured accessory", "name", d.Name, "type", d.Type, "aid", d.AID)
	}
	if len(accs) == 0 {
		return fmt.Errorf("no valid accessories configured")
	}

	b.bridgeAcc = accessory.NewBridge(accessory.Info{
		Name:         b.cfg.HomeKit.BridgeName,
		Manufacturer: "mqtt-home",
		Model:        "mqtt-homekit",
		Firmware:     version.Version,
	})
	b.bridgeAcc.Id = 1

	store := hap.NewFsStore(b.cfg.HomeKit.StorageDir)
	server, err := hap.NewServer(store, b.bridgeAcc.A, accs...)
	if err != nil {
		return fmt.Errorf("create HAP server: %w", err)
	}
	server.Pin = normalizePin(b.cfg.HomeKit.Pin)
	if b.cfg.HomeKit.SetupID != "" {
		server.SetupId = b.cfg.HomeKit.SetupID
	}
	if b.cfg.HomeKit.Port > 0 {
		server.Addr = fmt.Sprintf(":%d", b.cfg.HomeKit.Port)
	}
	if len(b.cfg.HomeKit.Interfaces) > 0 {
		server.Ifaces = b.cfg.HomeKit.Interfaces
	}
	b.server = server

	ctx, cancel := context.WithCancel(context.Background())
	b.cancel = cancel
	b.done = make(chan struct{})
	go func() {
		defer close(b.done)
		logger.Info("Starting HAP server", "bridge", b.cfg.HomeKit.BridgeName, "pin", b.cfg.HomeKit.Pin, "storage", b.cfg.HomeKit.StorageDir)
		if err := server.ListenAndServe(ctx); err != nil && ctx.Err() == nil {
			logger.Error("HAP server stopped", "error", err)
		}
	}()

	b.started = true
	logger.Info("mqtt-homekit bridge started", "accessories", len(b.devices))
	return nil
}

// Stop triggers a graceful HAP shutdown and waits for it to complete, so the
// dnssd "goodbye" is sent and controller connections are closed before the
// process exits — letting HomeKit mark the bridge offline immediately instead
// of after a timeout.
func (b *Bridge) Stop() {
	if b.cancel != nil {
		b.cancel()
	}
	if b.done != nil {
		select {
		case <-b.done:
		case <-time.After(5 * time.Second):
			logger.Warn("Timed out waiting for HAP server shutdown")
		}
	}
}

// setupURI builds the HomeKit "X-HM://" pairing payload (same encoding as
// HAP-NodeJS) used to render the pairing QR code.
func setupURI(pin string, category int, setupID string) string {
	code, _ := strconv.Atoi(normalizePin(pin))
	low := uint64(code) | (1 << 28) // bit 28: supports IP transport
	if category&1 == 1 {
		low |= 1 << 31
	}
	high := uint64(category >> 1)
	payload := high<<32 | low
	enc := strings.ToUpper(strconv.FormatUint(payload, 36))
	for len(enc) < 9 {
		enc = "0" + enc
	}
	return "X-HM://" + enc + setupID
}

// normalizePin strips formatting characters so a friendly "031-45-154" config
// value becomes the 8-digit code brutella/hap requires.
func normalizePin(pin string) string {
	var b []rune
	for _, r := range pin {
		if r >= '0' && r <= '9' {
			b = append(b, r)
		}
	}
	return string(b)
}
