package web

import (
	"net/http"
	"testing"
	"time"
)

func TestEvaluateLiveness(t *testing.T) {
	grace := 4 * time.Minute
	base := time.Date(2026, 6, 10, 8, 0, 0, 0, time.UTC)

	t.Run("healthy returns 200 and clears the timer", func(t *testing.T) {
		stuck := base.Add(-10 * time.Minute)
		code, since, _ := evaluateLiveness(true, &stuck, base, grace)
		if code != http.StatusOK || since != nil {
			t.Fatalf("got code=%d since=%v, want 200/nil", code, since)
		}
	})

	t.Run("within grace stays 200", func(t *testing.T) {
		since := base
		code, _, stuckFor := evaluateLiveness(false, &since, base.Add(2*time.Minute), grace)
		if code != http.StatusOK || stuckFor != 2*time.Minute {
			t.Fatalf("got code=%d stuckFor=%v", code, stuckFor)
		}
	})

	t.Run("beyond grace returns 503", func(t *testing.T) {
		since := base
		code, _, _ := evaluateLiveness(false, &since, base.Add(5*time.Minute), grace)
		if code != http.StatusServiceUnavailable {
			t.Fatalf("got %d, want 503", code)
		}
	})
}
