# syntax=docker/dockerfile:1.17

# Build stage for frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/web

COPY web/package.json web/pnpm-lock.yaml* web/pnpm-workspace.yaml ./
RUN npm install -g pnpm@11.5.1 && pnpm install --frozen-lockfile

COPY web/ .
RUN pnpm run build

# Build stage for backend
FROM golang:1.26-alpine AS backend-builder

WORKDIR /app
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o mqtt-homekit .

# Final stage
FROM gcr.io/distroless/static:nonroot

WORKDIR /
COPY --from=backend-builder /app/mqtt-homekit /mqtt-homekit
COPY --from=frontend-builder /app/web/dist /web/dist

USER nonroot:nonroot

ENTRYPOINT ["/mqtt-homekit", "/var/lib/mqtt-homekit/config.yaml"]
