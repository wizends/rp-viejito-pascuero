// Package hub reparte eventos en tiempo real a los WebSockets suscritos.
//
// Canales: "user:{id}" (estados de cartas, cambios del trayecto) y
// "track:{share_code}" (vista pública del niño).
//
// En un solo servidor (Docker, local) todo ocurre en memoria. En Vercel cada
// WebSocket queda fijo en una instancia distinta, así que los eventos viajan
// por Redis pub/sub: se publican en "vp:{canal}" y cada instancia con sockets
// abiertos los escucha y los entrega a los suyos.
package hub

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const redisPrefix = "vp:"

// Message es lo que recibe el navegador: {"event": ..., "data": ...}.
type Message struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

// Subscriber recibe mensajes ya serializados. Debe ser no bloqueante.
type Subscriber interface {
	Send(payload []byte) bool
}

type Hub struct {
	mu   sync.RWMutex
	subs map[string]map[Subscriber]struct{}

	rdb       *redis.Client
	listenMu  sync.Mutex
	listening bool
}

// New crea un hub en memoria (un solo servidor).
func New() *Hub { return &Hub{subs: map[string]map[Subscriber]struct{}{}} }

// NewRedis crea un hub que reparte los eventos entre instancias con Redis.
func NewRedis(url string) (*Hub, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	h := New()
	h.rdb = redis.NewClient(opt)
	return h, nil
}

// Close cierra la conexión a Redis (si hay).
func (h *Hub) Close() error {
	if h.rdb != nil {
		return h.rdb.Close()
	}
	return nil
}

func (h *Hub) Subscribe(channel string, s Subscriber) {
	h.mu.Lock()
	if h.subs[channel] == nil {
		h.subs[channel] = map[Subscriber]struct{}{}
	}
	h.subs[channel][s] = struct{}{}
	h.mu.Unlock()
	if h.rdb != nil {
		h.listen()
	}
}

func (h *Hub) Unsubscribe(channel string, s Subscriber) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subs[channel], s)
	if len(h.subs[channel]) == 0 {
		delete(h.subs, channel)
	}
}

// Publish entrega el evento a todos los suscriptores del canal (en todas las instancias).
func (h *Hub) Publish(channel, event string, data any) {
	payload, err := json.Marshal(Message{Event: event, Data: data})
	if err != nil {
		return
	}
	if h.rdb != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := h.rdb.Publish(ctx, redisPrefix+channel, payload).Err(); err == nil {
			return
		}
		slog.Warn("no se pudo publicar en Redis; se entrega solo en esta instancia", "err", err)
	}
	h.deliver(channel, payload)
}

func (h *Hub) deliver(channel string, payload []byte) {
	h.mu.RLock()
	targets := make([]Subscriber, 0, len(h.subs[channel]))
	for s := range h.subs[channel] {
		targets = append(targets, s)
	}
	h.mu.RUnlock()
	for _, s := range targets {
		if !s.Send(payload) {
			h.Unsubscribe(channel, s)
		}
	}
}

// listen arranca (una vez por instancia) la escucha de Redis. Solo hace falta
// mientras haya sockets abiertos, y ellos mismos mantienen viva la instancia.
func (h *Hub) listen() {
	h.listenMu.Lock()
	defer h.listenMu.Unlock()
	if h.listening {
		return
	}
	ctx := context.Background()
	ps := h.rdb.PSubscribe(ctx, redisPrefix+"*")
	// espera la confirmación para no perder eventos publicados justo después
	rctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	_, err := ps.Receive(rctx)
	cancel()
	if err != nil {
		slog.Warn("no se pudo escuchar Redis", "err", err)
		_ = ps.Close()
		return
	}
	h.listening = true
	go func() {
		defer func() {
			h.listenMu.Lock()
			h.listening = false
			h.listenMu.Unlock()
			_ = ps.Close()
		}()
		for msg := range ps.Channel() {
			h.deliver(strings.TrimPrefix(msg.Channel, redisPrefix), []byte(msg.Payload))
		}
	}()
}

// Count devuelve cuántos suscriptores locales tiene un canal (para pruebas).
func (h *Hub) Count(channel string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subs[channel])
}
