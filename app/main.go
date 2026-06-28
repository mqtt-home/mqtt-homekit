package main

import (
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"

	"github.com/mqtt-home/mqtt-homekit/bridge"
	"github.com/mqtt-home/mqtt-homekit/config"
	"github.com/mqtt-home/mqtt-homekit/version"
	"github.com/mqtt-home/mqtt-homekit/web"
	"github.com/philipparndt/go-logger"
)

func main() {
	logger.Init("info", logger.Logger())
	logger.Info("mqtt-homekit", "version", version.Info())
	initPprof()

	if len(os.Args) < 2 {
		logger.Error("No configuration file specified")
		os.Exit(1)
	}

	configFile := os.Args[1]
	logger.Info("Configuration file", "path", configFile)

	cfg, err := config.LoadConfig(configFile)
	if err != nil {
		logger.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}
	logger.SetLevel(cfg.LogLevel)

	// Persisted pairing state lives next to the config file unless overridden.
	if cfg.HomeKit.StorageDir == "" {
		cfg.HomeKit.StorageDir = filepath.Join(filepath.Dir(configFile), "hap")
	}

	b := bridge.New(cfg)

	var webServer *web.WebServer
	if cfg.Web.Enabled {
		webServer = web.NewWebServer(b)
	}

	if err := b.Start(); err != nil {
		logger.Error("Failed to start HomeKit bridge", "error", err)
		os.Exit(1)
	}

	if webServer != nil {
		go func() {
			port := cfg.Web.Port
			logger.Info("Web interface available", "url", "http://localhost:"+strconv.Itoa(port))
			if err := webServer.Start(port); err != nil {
				logger.Error("Failed to start web server", "error", err)
			}
		}()
	}

	logger.Info("Application ready")

	quitChannel := make(chan os.Signal, 1)
	signal.Notify(quitChannel, syscall.SIGINT, syscall.SIGTERM)
	<-quitChannel

	b.Stop()
	logger.Info("Shutdown complete")
}

func initPprof() {
	go func() {
		http.ListenAndServe(":6061", nil)
	}()
}
