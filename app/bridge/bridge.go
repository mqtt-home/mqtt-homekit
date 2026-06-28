package bridge

import (
	"context"
	"fmt"

	"github.com/brutella/hap"
	"github.com/brutella/hap/accessory"
	"github.com/mqtt-home/mqtt-homekit/config"
	"github.com/mqtt-home/mqtt-homekit/version"
	"github.com/philipparndt/go-logger"
	"github.com/philipparndt/mqtt-gateway/mqtt"
)

// Bridge maps MQTT topics to a HomeKit bridge accessory using brutella/hap.
type Bridge struct {
	cfg       config.Config
	server    *hap.Server
	bridgeAcc *accessory.Bridge
	devices   []*Device
	usedAIDs  map[uint64]bool
	cancel    context.CancelFunc
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
func (b *Bridge) Healthy() bool      { return b.started }

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

// Start connects to MQTT, builds the accessories and starts the HAP server.
func (b *Bridge) Start() error {
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
	server.Pin = b.cfg.HomeKit.Pin
	if b.cfg.HomeKit.SetupID != "" {
		server.SetupId = b.cfg.HomeKit.SetupID
	}
	if b.cfg.HomeKit.Port > 0 {
		server.Addr = fmt.Sprintf(":%d", b.cfg.HomeKit.Port)
	}
	b.server = server

	ctx, cancel := context.WithCancel(context.Background())
	b.cancel = cancel
	go func() {
		logger.Info("Starting HAP server", "bridge", b.cfg.HomeKit.BridgeName, "pin", b.cfg.HomeKit.Pin, "storage", b.cfg.HomeKit.StorageDir)
		if err := server.ListenAndServe(ctx); err != nil && ctx.Err() == nil {
			logger.Error("HAP server stopped", "error", err)
		}
	}()

	b.started = true
	logger.Info("mqtt-homekit bridge started", "accessories", len(b.devices))
	return nil
}

func (b *Bridge) Stop() {
	if b.cancel != nil {
		b.cancel()
	}
}
