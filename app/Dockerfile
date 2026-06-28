# syntax=docker/dockerfile:1.17

FROM golang:1.26-alpine AS build

WORKDIR /app
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w" -o mqtt-homekit .

FROM gcr.io/distroless/static:nonroot

WORKDIR /
COPY --from=build /app/mqtt-homekit /mqtt-homekit

USER nonroot:nonroot

ENTRYPOINT ["/mqtt-homekit", "/var/lib/mqtt-homekit/config.json"]
