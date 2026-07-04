package bridge

import (
	"testing"

	"github.com/mqtt-home/mqtt-homekit/config"
)

func TestExtract(t *testing.T) {
	if got := extract([]byte("21.5"), ""); got != "21.5" {
		t.Errorf("plain payload = %q", got)
	}
	if got := extract([]byte(`{"state":{"temperature":21.5}}`), "state.temperature"); got != "21.5" {
		t.Errorf("json path = %q, want 21.5", got)
	}
	if got := extract([]byte(`{"a":1}`), "missing"); got != "" {
		t.Errorf("missing path = %q, want empty", got)
	}
}

func TestParseBool(t *testing.T) {
	cases := []struct {
		src  config.ValueSource
		raw  string
		want bool
	}{
		{config.ValueSource{}, "ON", true},
		{config.ValueSource{}, "off", false},
		{config.ValueSource{On: "open"}, "open", true},
		{config.ValueSource{On: "open"}, "closed", false},
		{config.ValueSource{}, "1", true},
		{config.ValueSource{}, "0", false},
	}
	for _, c := range cases {
		if got := parseBool(c.src, c.raw); got != c.want {
			t.Errorf("parseBool(%+v, %q) = %v, want %v", c.src, c.raw, got, c.want)
		}
	}
}

func TestParseFloatFactorOffset(t *testing.T) {
	// e.g. millidegrees -> degrees
	v, ok := parseFloat(config.ValueSource{Factor: 0.001}, "21500")
	if !ok || v != 21.5 {
		t.Errorf("got %v ok=%v, want 21.5", v, ok)
	}
	v, _ = parseFloat(config.ValueSource{Offset: -273.15}, "294.15")
	if v < 20.99 || v > 21.01 {
		t.Errorf("offset got %v, want ~21", v)
	}
}

func TestPayloadRendering(t *testing.T) {
	if got := boolPayload(config.ValueSink{On: "OPEN", Off: "SHUT"}, true); got != "OPEN" {
		t.Errorf("boolPayload on = %q", got)
	}
	if got := numberPayload(config.ValueSink{Template: `{"pos":{{value}}}`}, 42); got != `{"pos":42}` {
		t.Errorf("numberPayload template = %q", got)
	}
	if got := numberPayload(config.ValueSink{}, 42); got != "42" {
		t.Errorf("numberPayload bare = %q", got)
	}
}

func TestSourceSinkFallback(t *testing.T) {
	acc := config.Accessory{Topic: "home/x"}
	if src := acc.Source("temperature"); src.Topic != "home/x" {
		t.Errorf("source fallback topic = %q", src.Topic)
	}
	if sink, ok := acc.Sink("on"); !ok || sink.Topic != "home/x" {
		t.Errorf("sink fallback = %q ok=%v", sink.Topic, ok)
	}
	empty := config.Accessory{}
	if _, ok := empty.Sink("on"); ok {
		t.Error("expected no sink without any topic")
	}
}

func TestMatchesFilter(t *testing.T) {
	press := []byte(`{"button":1,"event":"initial_press"}`)
	release := []byte(`{"button":1,"event":"short_release"}`)
	src := config.ValueSource{Match: map[string]string{"event": "short_release"}}

	if matchesFilter(src, press) {
		t.Error("initial_press should not match short_release filter")
	}
	if !matchesFilter(src, release) {
		t.Error("short_release should match")
	}
	if !matchesFilter(config.ValueSource{}, press) {
		t.Error("no filter should match everything")
	}
	multi := config.ValueSource{Match: map[string]string{"event": "short_release", "button": "2"}}
	if matchesFilter(multi, release) {
		t.Error("button 1 should not match button=2 condition")
	}
}
