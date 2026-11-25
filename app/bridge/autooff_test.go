package bridge

import (
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/brutella/hap/characteristic"
)

func TestOffTimerFiresOnceAfterOn(t *testing.T) {
	var fired atomic.Int32
	timer := newOffTimer(20*time.Millisecond, func() { fired.Add(1) })

	timer.set(true)
	time.Sleep(80 * time.Millisecond)
	if got := fired.Load(); got != 1 {
		t.Fatalf("fired %d times, want 1", got)
	}
}

func TestOffTimerIsCancelledBySwitchingOff(t *testing.T) {
	var fired atomic.Int32
	timer := newOffTimer(20*time.Millisecond, func() { fired.Add(1) })

	timer.set(true)
	timer.set(false)
	time.Sleep(80 * time.Millisecond)
	if got := fired.Load(); got != 0 {
		t.Fatalf("fired %d times, want 0", got)
	}
}

// A switch set on by the bridge itself (an MQTT message) goes off again and
// the timer's own SetValue(false) does not start another round.
func TestOffTimerOnACharacteristic(t *testing.T) {
	c := characteristic.NewOn()
	var fired atomic.Int32
	var timer *offTimer
	timer = newOffTimer(20*time.Millisecond, func() {
		fired.Add(1)
		c.SetValue(false)
	})
	c.OnValueUpdate(func(v, _ bool, _ *http.Request) { timer.set(v) })

	c.SetValue(true)
	time.Sleep(100 * time.Millisecond)
	if c.Value() {
		t.Fatal("switch is still on")
	}
	if got := fired.Load(); got != 1 {
		t.Fatalf("fired %d times, want 1", got)
	}
}
