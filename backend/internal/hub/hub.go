// Package hub reparte eventos en tiempo real a los WebSockets suscritos.
//
// Canales: "user:{id}" (estados de cartas, cambios del trayecto) y
// "track:{share_code}" (vista pública del niño).
package hub

import (
	"encoding/json"
	"sync"
)

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
}

func New() *Hub { return &Hub{subs: map[string]map[Subscriber]struct{}{}} }

func (h *Hub) Subscribe(channel string, s Subscriber) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.subs[channel] == nil {
		h.subs[channel] = map[Subscriber]struct{}{}
	}
	h.subs[channel][s] = struct{}{}
}

func (h *Hub) Unsubscribe(channel string, s Subscriber) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subs[channel], s)
	if len(h.subs[channel]) == 0 {
		delete(h.subs, channel)
	}
}

// Publish entrega el evento a todos los suscriptores del canal.
func (h *Hub) Publish(channel, event string, data any) {
	payload, err := json.Marshal(Message{Event: event, Data: data})
	if err != nil {
		return
	}
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

// Count devuelve cuántos suscriptores tiene un canal (para pruebas).
func (h *Hub) Count(channel string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subs[channel])
}
