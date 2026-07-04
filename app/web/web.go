package web

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mqtt-home/mqtt-homekit/bridge"
	"github.com/mqtt-home/mqtt-homekit/config"
	"github.com/philipparndt/go-logger"
	loggerchi "github.com/philipparndt/go-logger/chi"
	qrcode "github.com/skip2/go-qrcode"
)

type SSEClient struct {
	ID      string
	Channel chan string
}

// WebServer exposes a REST + SSE API and the static SPA for the bridge.
type WebServer struct {
	b      *bridge.Bridge
	router *chi.Mux

	sseClients   map[string]*SSEClient
	sseClientsMu sync.RWMutex

	unhealthySince *time.Time
}

func NewWebServer(b *bridge.Bridge) *WebServer {
	ws := &WebServer{
		b:          b,
		router:     chi.NewRouter(),
		sseClients: make(map[string]*SSEClient),
	}
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
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Content-Type"},
		MaxAge:         300,
	}))

	ws.router.Route("/api", func(r chi.Router) {
		r.Get("/health", ws.health)
		r.Get("/livez", ws.liveness)
		r.Get("/info", ws.info)
		r.Get("/devices", ws.devices)
		r.Post("/devices/{aid}/control", ws.control)
		r.Get("/qr", ws.qr)
		r.Get("/events", ws.handleSSE)
	})

	// SPA: serve static files, fall back to index.html for client-side routes.
	distDir := "./web/dist/"
	fileServer := http.FileServer(http.Dir(distDir))
	ws.router.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
		path := "." + r.URL.Path
		if _, err := http.Dir(distDir).Open(path); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, distDir+"index.html")
	})
}

// deviceJSON is the per-accessory payload used by both REST and SSE.
type deviceJSON struct {
	Type     string         `json:"type"` // SSE event discriminator
	AID      uint64         `json:"aid"`
	Name     string         `json:"name"`
	Kind     string         `json:"kind"` // accessory type (temperature, switch, ...)
	Room     string         `json:"room"` // web-UI grouping (empty = ungrouped)
	State    map[string]any `json:"state"`
	Controls []string       `json:"controls"` // writable characteristic names
}

func toDeviceJSON(d *bridge.Device) deviceJSON {
	return deviceJSON{Type: "device", AID: d.AID, Name: d.Name, Kind: d.Type, Room: d.Room, State: d.State(), Controls: d.Controls()}
}

func (ws *WebServer) info(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{
		"bridge":      ws.b.BridgeName(),
		"pin":         ws.b.Pin(),
		"setup_id":    ws.b.SetupID(),
		"setup_uri":   ws.b.SetupURI(),
		"accessories": len(ws.b.Devices()),
		"healthy":     ws.b.Healthy(),
	})
}

func (ws *WebServer) devices(w http.ResponseWriter, _ *http.Request) {
	devs := ws.b.Devices()
	out := make([]deviceJSON, 0, len(devs))
	for _, d := range devs {
		out = append(out, toDeviceJSON(d))
	}
	writeJSON(w, out)
}

// control sets a writable characteristic on a device (web UI control panel).
func (ws *WebServer) control(w http.ResponseWriter, r *http.Request) {
	aid, err := strconv.ParseUint(chi.URLParam(r, "aid"), 10, 64)
	if err != nil {
		http.Error(w, "invalid aid", http.StatusBadRequest)
		return
	}
	var req struct {
		Name  string `json:"name"`
		Value any    `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, "invalid body, expected {\"name\": ..., \"value\": ...}", http.StatusBadRequest)
		return
	}
	for _, d := range ws.b.Devices() {
		if d.AID != aid {
			continue
		}
		if err := d.Control(req.Name, req.Value); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		logger.Info("Web control", "device", d.Name, "characteristic", req.Name, "value", req.Value)
		writeJSON(w, toDeviceJSON(d))
		return
	}
	http.Error(w, "device not found", http.StatusNotFound)
}

// qr renders the HomeKit pairing QR code as a PNG.
func (ws *WebServer) qr(w http.ResponseWriter, _ *http.Request) {
	png, err := qrcode.Encode(ws.b.SetupURI(), qrcode.Medium, 320)
	if err != nil {
		http.Error(w, "qr error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(png)
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

// --- SSE ---

// BroadcastDevice pushes a device state update to all connected SSE clients.
func (ws *WebServer) BroadcastDevice(d *bridge.Device) {
	message, err := json.Marshal(toDeviceJSON(d))
	if err != nil {
		return
	}
	ws.broadcast(string(message))
}

// BroadcastIdentify pushes a HomeKit identify request to all SSE clients so
// the dashboard can point out which device is being placed in the Home app.
func (ws *WebServer) BroadcastIdentify(name, room string) {
	message, err := json.Marshal(map[string]string{"type": "identify", "name": name, "room": room})
	if err != nil {
		return
	}
	ws.broadcast(string(message))
}

func (ws *WebServer) broadcast(msg string) {
	ws.sseClientsMu.RLock()
	for _, c := range ws.sseClients {
		select {
		case c.Channel <- msg:
		default:
		}
	}
	ws.sseClientsMu.RUnlock()
}

func (ws *WebServer) handleSSE(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	clientID := fmt.Sprintf("%d", time.Now().UnixNano())
	channel := make(chan string, 16)

	ws.sseClientsMu.Lock()
	ws.sseClients[clientID] = &SSEClient{ID: clientID, Channel: channel}
	ws.sseClientsMu.Unlock()

	// Initial snapshot for all devices.
	for _, d := range ws.b.Devices() {
		if msg, err := json.Marshal(toDeviceJSON(d)); err == nil {
			fmt.Fprintf(w, "data: %s\n\n", string(msg))
		}
	}
	flusher, ok := w.(http.Flusher)
	if ok {
		flusher.Flush()
	}

	defer func() {
		ws.sseClientsMu.Lock()
		delete(ws.sseClients, clientID)
		close(channel)
		ws.sseClientsMu.Unlock()
	}()

	for {
		select {
		case msg := <-channel:
			if _, err := fmt.Fprintf(w, "data: %s\n\n", msg); err != nil {
				return
			}
			if ok {
				flusher.Flush()
			}
		case <-r.Context().Done():
			return
		}
	}
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
