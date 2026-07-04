package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/philipparndt/go-logger"
	"github.com/philipparndt/mqtt-gateway/config"
	yaml "sigs.k8s.io/yaml"
)

var cfg Config

type Config struct {
	MQTT        config.MQTTConfig `json:"mqtt"`
	HomeKit     HomeKitConfig     `json:"homekit"`
	Web         WebConfig         `json:"web"`
	Pprof       PprofConfig       `json:"pprof"`
	Accessories []Accessory       `json:"accessories"`
	LogLevel    string            `json:"loglevel,omitempty"`
}

type HomeKitConfig struct {
	// BridgeName is the HomeKit bridge name shown in the Home app.
	BridgeName string `json:"bridge_name,omitempty"`
	// Pin is the 8-digit setup code, format "XXX-XX-XXX".
	Pin string `json:"pin,omitempty"`
	// SetupID is the 4-char HomeKit setup id (optional; affects the QR/URI only).
	SetupID string `json:"setup_id,omitempty"`
	// StorageDir holds the persisted pairing keys/state. MUST survive restarts
	// (mount a volume in Kubernetes) or HomeKit pairing is lost on every restart.
	// Defaults to "<config-dir>/hap".
	StorageDir string `json:"storage_dir,omitempty"`
	// Port is the HAP TCP port. 0 lets the OS choose (fine unless you need a
	// stable port through a firewall with hostNetwork).
	Port int `json:"port,omitempty"`
	// Interfaces restricts the network interfaces the bridge advertises on
	// (e.g. ["en0"]). On a multi-homed host, leaving this empty makes the
	// controller try unreachable secondary/VM IPs and fail to connect. Empty
	// means all interfaces.
	Interfaces []string `json:"interfaces,omitempty"`
}

type WebConfig struct {
	Enabled              bool `json:"enabled"`
	Port                 int  `json:"port"`
	LivenessGraceSeconds int  `json:"liveness_grace_seconds,omitempty"`
}

// PprofConfig enables the Go pprof profiling endpoint. Disabled by default;
// only enable on trusted networks — pprof exposes runtime internals.
type PprofConfig struct {
	Enabled bool `json:"enabled,omitempty"`
	// Port defaults to 6060.
	Port int `json:"port,omitempty"`
	// Bind restricts the listen address (e.g. "127.0.0.1" to keep pprof
	// reachable only via localhost / kubectl port-forward). Empty = all
	// interfaces.
	Bind string `json:"bind,omitempty"`
}

// Accessory is one HomeKit accessory mapped to MQTT. Per-characteristic topics,
// JSON paths and value mappings make it adaptable to differing MQTT layouts.
type Accessory struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Manufacturer string `json:"manufacturer,omitempty"`
	Model        string `json:"model,omitempty"`
	// Room groups accessories in the web UI. HomeKit room assignment is
	// controller-side data (done in the Home app) and cannot be set by a bridge.
	Room string `json:"room,omitempty"`
	// Topic is the default state/command topic used by a characteristic when it
	// has no explicit entry in Get/Set.
	Topic string `json:"topic,omitempty"`
	// Get maps a characteristic name to its read source (MQTT -> HomeKit).
	Get map[string]ValueSource `json:"get,omitempty"`
	// Set maps a characteristic name to its write sink (HomeKit -> MQTT).
	Set map[string]ValueSink `json:"set,omitempty"`
}

// ValueSource describes how to read a characteristic value from an MQTT message.
type ValueSource struct {
	Topic string `json:"topic,omitempty"`
	// Path extracts a value from a JSON payload via dot notation (e.g.
	// "state.temperature"). Empty means use the whole payload.
	Path string `json:"path,omitempty"`
	// Match filters messages: every key is a dot-path into the JSON payload
	// and the message is ignored unless all extracted values equal the given
	// strings (case-insensitive). Lets e.g. a button map only
	// {"event":"short_release"} messages, skipping press/hold events.
	Match map[string]string `json:"match,omitempty"`
	// On/Off map a payload string to a boolean (case-insensitive). For sensors,
	// "on" means active/open/detected.
	On  string `json:"on,omitempty"`
	Off string `json:"off,omitempty"`
	// Factor/Offset transform numeric values: out = in*Factor + Offset
	// (Factor defaults to 1 when 0).
	Factor float64 `json:"factor,omitempty"`
	Offset float64 `json:"offset,omitempty"`
}

// ValueSink describes how to publish a characteristic change to MQTT.
type ValueSink struct {
	Topic string `json:"topic,omitempty"`
	// On/Off are the payloads sent for boolean true/false (default "true"/"false").
	On  string `json:"on,omitempty"`
	Off string `json:"off,omitempty"`
	// Template formats numeric/int payloads; "{{value}}" is replaced with the
	// number. Empty sends the bare number.
	Template string  `json:"template,omitempty"`
	Retain   bool    `json:"retain,omitempty"`
	Factor   float64 `json:"factor,omitempty"`
	Offset   float64 `json:"offset,omitempty"`
	// Round rounds the computed value to the nearest integer before formatting
	// (useful when a transform produces fractions, e.g. tilt-angle → slat %).
	Round bool `json:"round,omitempty"`
}

// Source returns the read source for a characteristic, falling back to the
// accessory's base Topic.
func (a Accessory) Source(name string) ValueSource {
	if a.Get != nil {
		if s, ok := a.Get[name]; ok {
			if s.Topic == "" {
				s.Topic = a.Topic
			}
			return s
		}
	}
	return ValueSource{Topic: a.Topic}
}

// Sink returns the write sink for a characteristic, falling back to the
// accessory's base Topic. The bool reports whether a usable topic exists.
func (a Accessory) Sink(name string) (ValueSink, bool) {
	if a.Set != nil {
		if s, ok := a.Set[name]; ok {
			if s.Topic == "" {
				s.Topic = a.Topic
			}
			return s, s.Topic != ""
		}
	}
	if a.Topic != "" {
		return ValueSink{Topic: a.Topic}, true
	}
	return ValueSink{}, false
}

func LoadConfig(file string) (Config, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		logger.Error("Error reading config file", "error", err)
		return Config{}, err
	}

	data = config.ReplaceEnvVariables(data)

	// YAML configs are converted to JSON so the same structs (and the
	// mqtt-gateway MQTTConfig json tags) work for both formats.
	if ext := strings.ToLower(filepath.Ext(file)); ext == ".yaml" || ext == ".yml" {
		data, err = yaml.YAMLToJSON(data)
		if err != nil {
			logger.Error("Converting YAML config", "error", err)
			return Config{}, err
		}
	}

	if err := json.Unmarshal(data, &cfg); err != nil {
		logger.Error("Unmarshaling JSON", "error", err)
		return Config{}, err
	}

	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}
	if cfg.HomeKit.BridgeName == "" {
		cfg.HomeKit.BridgeName = "MQTT HomeKit"
	}
	if cfg.HomeKit.Pin == "" {
		cfg.HomeKit.Pin = "031-45-154"
	}
	if cfg.HomeKit.SetupID == "" {
		// A stable 4-char setup id is needed for the pairing QR code. Changing it
		// later only affects the QR/discovery, not existing pairings.
		cfg.HomeKit.SetupID = "MQTT"
	}
	if cfg.Web.Port == 0 {
		cfg.Web.Port = 8080
	}
	if cfg.Pprof.Port == 0 {
		cfg.Pprof.Port = 6060
	}

	return cfg, nil
}

func Get() Config {
	return cfg
}
