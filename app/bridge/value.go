package bridge

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/mqtt-home/mqtt-homekit/config"
)

// extract pulls a string value out of an MQTT payload. With no path the trimmed
// payload is returned; with a dot path the payload is parsed as JSON and walked.
func extract(payload []byte, path string) string {
	raw := strings.TrimSpace(string(payload))
	if path == "" {
		return raw
	}
	var data any
	if err := json.Unmarshal(payload, &data); err != nil {
		return raw
	}
	cur := data
	for _, key := range strings.Split(path, ".") {
		m, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur = m[key]
	}
	if cur == nil {
		return ""
	}
	return fmt.Sprint(cur)
}

// parseBool maps a payload string to a boolean using the source's On/Off
// mappings, then a set of common truthy tokens, then a numeric != 0 fallback.
func parseBool(s config.ValueSource, raw string) bool {
	raw = strings.TrimSpace(raw)
	if s.On != "" && strings.EqualFold(raw, s.On) {
		return true
	}
	if s.Off != "" && strings.EqualFold(raw, s.Off) {
		return false
	}
	switch strings.ToLower(raw) {
	case "true", "1", "on", "open", "yes", "detected", "active", "y":
		return true
	case "false", "0", "off", "closed", "no", "n":
		return false
	}
	if f, err := strconv.ParseFloat(raw, 64); err == nil {
		return f != 0
	}
	return false
}

// parseFloat parses a numeric payload and applies Factor/Offset.
func parseFloat(s config.ValueSource, raw string) (float64, bool) {
	f, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return 0, false
	}
	factor := s.Factor
	if factor == 0 {
		factor = 1
	}
	return f*factor + s.Offset, true
}

// boolPayload renders a boolean for publishing.
func boolPayload(s config.ValueSink, v bool) string {
	if v {
		if s.On != "" {
			return s.On
		}
		return "true"
	}
	if s.Off != "" {
		return s.Off
	}
	return "false"
}

// numberPayload renders a number for publishing, applying Factor/Offset and an
// optional template.
func numberPayload(s config.ValueSink, v float64) string {
	factor := s.Factor
	if factor == 0 {
		factor = 1
	}
	v = v*factor + s.Offset
	str := strconv.FormatFloat(v, 'f', -1, 64)
	if s.Template != "" {
		return strings.ReplaceAll(s.Template, "{{value}}", str)
	}
	return str
}
