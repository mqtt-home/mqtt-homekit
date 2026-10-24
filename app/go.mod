module github.com/mqtt-home/mqtt-homekit

go 1.26.2

require (
	github.com/brutella/dnssd v1.2.14
	github.com/brutella/hap v0.0.35
	github.com/go-chi/chi/v5 v5.5.0
	github.com/go-chi/cors v1.2.2
	github.com/philipparndt/go-logger v1.10.0
	github.com/philipparndt/go-logger/chi v1.10.0
	github.com/philipparndt/mqtt-gateway v1.11.0
	github.com/skip2/go-qrcode v0.0.0-20200617195104-da1b6568686e
	sigs.k8s.io/yaml v1.6.0
)

require (
	github.com/eclipse/paho.mqtt.golang v1.5.1 // indirect
	github.com/go-chi/chi v1.5.5 // indirect
	github.com/go-logr/logr v1.4.4 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/miekg/dns v1.1.73 // indirect
	github.com/tadglines/go-pkgs v0.0.0-20210623144937-b983b20f54f9 // indirect
	github.com/vishvananda/netlink v1.3.1 // indirect
	github.com/vishvananda/netns v0.0.5 // indirect
	github.com/xiam/to v0.0.0-20200126224905-d60d31e03561 // indirect
	go.yaml.in/yaml/v2 v2.4.4 // indirect
	golang.org/x/crypto v0.58.0 // indirect
	golang.org/x/net v0.61.0 // indirect
	golang.org/x/sync v0.24.0 // indirect
	golang.org/x/sys v0.49.0 // indirect
	golang.org/x/text v0.43.0 // indirect
	gopkg.in/Regis24GmbH/go-diacritics.v2 v2.0.3 // indirect
	k8s.io/klog/v2 v2.140.0 // indirect
)

replace github.com/brutella/dnssd => ./third_party/dnssd
