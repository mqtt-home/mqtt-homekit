package web

import (
	_ "embed"
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mqtt-home/mqtt-homekit/bridge"
	"github.com/mqtt-home/mqtt-homekit/config"
	"github.com/philipparndt/go-logger"
	loggerchi "github.com/philipparndt/go-logger/chi"
)

//go:embed index.html
var indexHTML []byte

// WebServer exposes a small status page and JSON API for the bridge.
type WebServer struct {
	b      *bridge.Bridge
	router *chi.Mux

	unhealthySince *time.Time
}

func NewWebServer(b *bridge.Bridge) *WebServer {
	ws := &WebServer{b: b, router: chi.NewRouter()}
	ws.setupRoutes()
	return ws
}

func (ws *WebServer) livenessGrace() time.Duration {
	if s := config.Get().Web.LivenessGraceSeconds; s > 0 {
		return time.Duration(s) * time.Second
	}
	return 4 * time.Minute
}

func (ws *WebServer) setupRoutes() {
	ws.router.Use(loggerchi.LoggerWithLevel(slog.LevelDebug))
	ws.router.Use(middleware.Recoverer)
	ws.router.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Content-Type"},
		MaxAge:         300,
	}))

	ws.router.Route("/api", func(r chi.Router) {
		r.Get("/health", ws.health)
		r.Get("/livez", ws.liveness)
		r.Get("/info", ws.info)
		r.Get("/devices", ws.devices)
	})

	ws.router.Get("/*", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexHTML)
	})
}

func (ws *WebServer) info(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{
		"bridge":      ws.b.BridgeName(),
		"pin":         ws.b.Pin(),
		"accessories": len(ws.b.Devices()),
		"healthy":     ws.b.Healthy(),
	})
}

type deviceJSON struct {
	Name  string         `json:"name"`
	Type  string         `json:"type"`
	AID   uint64         `json:"aid"`
	State map[string]any `json:"state"`
}

func (ws *WebServer) devices(w http.ResponseWriter, _ *http.Request) {
	devs := ws.b.Devices()
	out := make([]deviceJSON, 0, len(devs))
	for _, d := range devs {
		out = append(out, deviceJSON{Name: d.Name, Type: d.Type, AID: d.AID, State: d.State()})
	}
	writeJSON(w, out)
}

func (ws *WebServer) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{
		"status":      "ok",
		"goroutines":  runtime.NumGoroutine(),
		"accessories": len(ws.b.Devices()),
		"healthy":     ws.b.Healthy(),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (ws *WebServer) liveness(w http.ResponseWriter, _ *http.Request) {
	statusCode, newSince, stuckFor := evaluateLiveness(ws.b.Healthy(), ws.unhealthySince, time.Now(), ws.livenessGrace())
	ws.unhealthySince = newSince
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]any{
		"healthy":         ws.b.Healthy(),
		"stuckForSeconds": int(stuckFor.Seconds()),
		"timestamp":       time.Now().UTC().Format(time.RFC3339),
	})
}

// evaluateLiveness fails (503) only after the bridge has been continuously
// unhealthy for longer than the grace window.
func evaluateLiveness(healthy bool, unhealthySince *time.Time, now time.Time, grace time.Duration) (int, *time.Time, time.Duration) {
	if healthy {
		return http.StatusOK, nil, 0
	}
	if unhealthySince == nil {
		t := now
		unhealthySince = &t
	}
	stuckFor := now.Sub(*unhealthySince)
	code := http.StatusOK
	if stuckFor > grace {
		code = http.StatusServiceUnavailable
	}
	return code, unhealthySince, stuckFor
}

func (ws *WebServer) Start(port int) error {
	addr := ":" + strconv.Itoa(port)
	logger.Info("Starting web server", "address", addr)
	return http.ListenAndServe(addr, ws.router)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
