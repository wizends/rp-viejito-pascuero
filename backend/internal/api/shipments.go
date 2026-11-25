package api

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
)

const maxStops = 30

var stopIcons = map[string]bool{
	"carta": true, "taller": true, "lupa": true, "regalo": true, "trineo": true,
	"reno": true, "montana": true, "ciudad": true, "arbol": true, "estrella": true,
}

type template struct {
	nombre, icono, desc string
	lat, lng            *float64
	hoursBefore         float64
}

func f(v float64) *float64 { return &v }

// Plantillas del viaje del regalo (horas antes de la llegada).
var templates = []template{
	{"Carta recibida en el Polo Norte", "carta", "Tu carta llegó al buzón del taller.", nil, nil, 240},
	{"Duendes fabricando tu regalo", "taller", "Martillos, pegamento y mucha risa.", nil, nil, 168},
	{"Control de calidad de los duendes", "lupa", "Lo revisan tres veces con lupa.", nil, nil, 72},
	{"Envuelto con cinta dorada", "regalo", "Papel brillante y un moño gigante.", nil, nil, 30},
	{"Cargado en el trineo", "trineo", "Bien amarrado para que no se caiga.", nil, nil, 12},
	{"Los renos calientan motores", "reno", "Avena mágica y estiramientos.", nil, nil, 6},
	{"Sobrevolando la Cordillera de los Andes", "montana", "¡Qué frío hace allá arriba!", f(-27.1), f(-68.5), 2},
	{"Llegando a tu ciudad", "ciudad", "Ya se ven las luces de las casas.", f(-33.45), f(-70.66), 0.5},
	{"¡Bajo el árbol!", "arbol", "El regalo te espera. ¡Feliz Navidad!", nil, nil, 0},
}

type stopOut struct {
	ID          string     `json:"id"`
	Position    int        `json:"position"`
	Nombre      string     `json:"nombre"`
	Icono       string     `json:"icono"`
	Descripcion string     `json:"descripcion"`
	Lat         *float64   `json:"lat"`
	Lng         *float64   `json:"lng"`
	ETA         *time.Time `json:"eta"`
	CompletedAt *time.Time `json:"completed_at"`
	AutoAdvance bool       `json:"auto_advance"`
}

type shipmentOut struct {
	ID        string    `json:"id"`
	ChildID   string    `json:"child_id"`
	ShareCode string    `json:"share_code"`
	ArrivalAt time.Time `json:"arrival_at"`
	// HasTreePhoto: el padre subió la foto del árbol para la selfie del Viejito.
	HasTreePhoto bool      `json:"has_tree_photo"`
	Stops        []stopOut `json:"stops"`
}

// trackingOut es la vista pública del niño: sin ids internos del padre.
type trackingOut struct {
	Nickname   string    `json:"nickname"`
	Avatar     string    `json:"avatar"`
	ArrivalAt  time.Time `json:"arrival_at"`
	ServerTime time.Time `json:"server_time"`
	// Selfie: el regalo llegó y hay foto del árbol; se pide en /api/tracking/{code}/selfie.
	Selfie bool      `json:"selfie"`
	Stops  []stopOut `json:"stops"`
}

func toStopOut(st store.Stop) stopOut {
	return stopOut{ID: st.ID, Position: st.Position, Nombre: st.Nombre, Icono: st.Icono, Descripcion: st.Descripcion,
		Lat: st.Lat, Lng: st.Lng, ETA: st.ETA, CompletedAt: st.CompletedAt, AutoAdvance: st.AutoAdvance}
}

func toShipmentOut(sh *store.Shipment) shipmentOut {
	stops := make([]stopOut, 0, len(sh.Stops))
	for _, st := range sh.Stops {
		stops = append(stops, toStopOut(st))
	}
	return shipmentOut{ID: sh.ID, ChildID: sh.ChildID, ShareCode: sh.ShareCode, ArrivalAt: sh.ArrivalAt, HasTreePhoto: sh.HasTree, Stops: stops}
}

// defaultArrival es la medianoche entre el 24 y el 25 de diciembre (Nochebuena), hora local.
func (s *Server) defaultArrival() time.Time {
	now := s.now().In(s.loc)
	year := now.Year()
	if now.Month() == time.December && now.Day() > 25 {
		year++
	}
	return time.Date(year, time.December, 25, 0, 0, 0, 0, s.loc).UTC()
}

func (s *Server) publicView(ctx context.Context, sh *store.Shipment) (*trackingOut, error) {
	child, err := s.store.ChildByID(ctx, sh.ChildID)
	if err != nil {
		return nil, err
	}
	out := toShipmentOut(sh)
	return &trackingOut{Nickname: child.Nickname, Avatar: child.Avatar, ArrivalAt: sh.ArrivalAt,
		ServerTime: s.now().UTC(), Selfie: sh.HasTree && s.delivered(sh), Stops: out.Stops}, nil
}

// broadcast avisa al niño (vista pública) y al padre (panel) que el trayecto cambió.
func (s *Server) broadcast(ctx context.Context, sh *store.Shipment, completed ...string) {
	view, err := s.publicView(ctx, sh)
	if err != nil {
		return
	}
	channel := "track:" + sh.ShareCode
	s.hub.Publish(channel, "tracking.updated", view)
	for _, id := range completed {
		for _, st := range sh.Stops {
			if st.ID == id {
				s.hub.Publish(channel, "tracking.stop_completed", toStopOut(st))
			}
		}
	}
	if child, err := s.store.ChildByID(ctx, sh.ChildID); err == nil {
		s.hub.Publish("user:"+child.UserID, "shipment.updated", map[string]string{"id": sh.ID})
	}
}

// reply recarga el trayecto, avisa y lo devuelve.
func (s *Server) reply(w http.ResponseWriter, r *http.Request, id string, status int, completed ...string) {
	sh, err := s.store.ShipmentByID(r.Context(), id)
	if err != nil {
		writeErr(w, err)
		return
	}
	s.broadcast(r.Context(), sh, completed...)
	writeJSON(w, status, toShipmentOut(sh))
}

func (s *Server) getShipment(w http.ResponseWriter, r *http.Request, u *store.User) {
	child, err := s.store.OwnChild(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	s.advanceDueStops(r.Context()) // avance perezoso: no depende de un proceso de fondo
	sh, err := s.store.ShipmentForChild(r.Context(), child.ID, s.defaultArrival())
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toShipmentOut(sh))
}

func (s *Server) updateShipment(w http.ResponseWriter, r *http.Request, u *store.User) {
	sh, err := s.store.OwnShipment(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var in struct {
		ArrivalAt *jsonTime `json:"arrival_at"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if in.ArrivalAt == nil {
		writeErr(w, invalid("Falta la fecha de llegada."))
		return
	}
	if err := s.store.SetArrival(r.Context(), sh.ID, in.ArrivalAt.Time); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, sh.ID, http.StatusOK)
}

type stopIn struct {
	Nombre      Opt[string]   `json:"nombre"`
	Icono       Opt[string]   `json:"icono"`
	Descripcion Opt[string]   `json:"descripcion"`
	Lat         Opt[float64]  `json:"lat"`
	Lng         Opt[float64]  `json:"lng"`
	ETA         Opt[jsonTime] `json:"eta"`
	AutoAdvance Opt[bool]     `json:"auto_advance"`
	Completed   Opt[bool]     `json:"completed"`
}

// apply valida y copia los campos presentes sobre la parada.
func (in *stopIn) apply(st *store.Stop) error {
	var err error
	if in.Nombre.Has() {
		if st.Nombre, err = checkLen("nombre", in.Nombre.V, 1, 80); err != nil {
			return err
		}
	}
	if in.Icono.Has() {
		if !stopIcons[in.Icono.V] {
			return invalid("Ese ícono no existe.")
		}
		st.Icono = in.Icono.V
	}
	if in.Descripcion.Has() {
		if st.Descripcion, err = checkLen("descripción", in.Descripcion.V, 0, 280); err != nil {
			return err
		}
	}
	if in.Lat.Set {
		if in.Lat.Null {
			st.Lat = nil
		} else if v := in.Lat.V; v < -90 || v > 90 {
			return invalid("Latitud fuera de rango.")
		} else {
			st.Lat = &v
		}
	}
	if in.Lng.Set {
		if in.Lng.Null {
			st.Lng = nil
		} else if v := in.Lng.V; v < -180 || v > 180 {
			return invalid("Longitud fuera de rango.")
		} else {
			st.Lng = &v
		}
	}
	if in.ETA.Set {
		if in.ETA.Null {
			st.ETA = nil
		} else {
			t := in.ETA.V.Time
			st.ETA = &t
		}
	}
	if in.AutoAdvance.Has() {
		st.AutoAdvance = in.AutoAdvance.V
	}
	return nil
}

func (s *Server) addStop(w http.ResponseWriter, r *http.Request, u *store.User) {
	sh, err := s.store.OwnShipment(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var in stopIn
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if !in.Nombre.Has() {
		writeErr(w, invalid("La parada necesita un nombre."))
		return
	}
	st := store.Stop{Icono: "estrella"}
	if err := in.apply(&st); err != nil {
		writeErr(w, err)
		return
	}
	if len(sh.Stops) >= maxStops {
		writeErr(w, errf(http.StatusBadRequest, "El trineo no aguanta más de 30 paradas."))
		return
	}
	if err := s.store.AddStops(r.Context(), sh.ID, len(sh.Stops), []store.Stop{st}); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, sh.ID, http.StatusCreated)
}

func (s *Server) addTemplates(w http.ResponseWriter, r *http.Request, u *store.User) {
	sh, err := s.store.OwnShipment(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	if len(sh.Stops)+len(templates) > maxStops {
		writeErr(w, errf(http.StatusBadRequest, "El trineo no aguanta más de 30 paradas."))
		return
	}
	stops := make([]store.Stop, 0, len(templates))
	for _, t := range templates {
		eta := sh.ArrivalAt.Add(-time.Duration(t.hoursBefore * float64(time.Hour)))
		stops = append(stops, store.Stop{Nombre: t.nombre, Icono: t.icono, Descripcion: t.desc,
			Lat: t.lat, Lng: t.lng, ETA: &eta, AutoAdvance: true})
	}
	if err := s.store.AddStops(r.Context(), sh.ID, len(sh.Stops), stops); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, sh.ID, http.StatusOK)
}

func (s *Server) reorderStops(w http.ResponseWriter, r *http.Request, u *store.User) {
	sh, err := s.store.OwnShipment(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	var in struct {
		IDs []string `json:"ids"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	current := make([]string, 0, len(sh.Stops))
	for _, st := range sh.Stops {
		current = append(current, st.ID)
	}
	got := slices.Clone(in.IDs)
	slices.Sort(got)
	slices.Sort(current)
	if len(in.IDs) > 50 || !slices.Equal(got, current) {
		writeErr(w, invalid("El orden debe incluir todas las paradas una vez."))
		return
	}
	if err := s.store.Reorder(r.Context(), in.IDs); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, sh.ID, http.StatusOK)
}

func (s *Server) updateStop(w http.ResponseWriter, r *http.Request, u *store.User) {
	shipID, err := s.store.OwnStop(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	sh, err := s.store.ShipmentByID(r.Context(), shipID)
	if err != nil {
		writeErr(w, err)
		return
	}
	var st store.Stop
	for _, x := range sh.Stops {
		if x.ID == r.PathValue("id") {
			st = x
		}
	}
	var in stopIn
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if err := in.apply(&st); err != nil {
		writeErr(w, err)
		return
	}
	var completed []string
	if in.Completed.Has() {
		if in.Completed.V && st.CompletedAt == nil {
			now := s.now().UTC()
			st.CompletedAt = &now
			completed = append(completed, st.ID)
		} else if !in.Completed.V {
			st.CompletedAt = nil
		}
	}
	if err := s.store.UpdateStop(r.Context(), &st); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, shipID, http.StatusOK, completed...)
}

func (s *Server) deleteStop(w http.ResponseWriter, r *http.Request, u *store.User) {
	shipID, err := s.store.OwnStop(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writeErr(w, notFound(err))
		return
	}
	if err := s.store.DeleteStop(r.Context(), shipID, r.PathValue("id")); err != nil {
		writeErr(w, err)
		return
	}
	s.reply(w, r, shipID, http.StatusOK)
}

func (s *Server) publicTracking(w http.ResponseWriter, r *http.Request) {
	s.advanceDueStops(r.Context())
	sh, err := s.store.ShipmentByCode(r.Context(), r.PathValue("code"))
	if err != nil {
		writeErr(w, errf(http.StatusNotFound, "Este código de seguimiento no existe."))
		return
	}
	view, err := s.publicView(r.Context(), sh)
	if err != nil {
		writeErr(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, view)
}

// cronTick lo llama Vercel Cron (o cualquier programador): avance de paradas y retención.
func (s *Server) cronTick(w http.ResponseWriter, r *http.Request) {
	if s.cfg.CronSecret != "" && r.Header.Get("Authorization") != "Bearer "+s.cfg.CronSecret {
		writeErr(w, errf(http.StatusUnauthorized, "No autorizado."))
		return
	}
	n := s.advanceDueStops(r.Context())
	s.purgeExpiredImages(r.Context())
	writeJSON(w, http.StatusOK, map[string]int{"paradas_completadas": n})
}

// advanceDueStops completa las paradas con auto-avance cuya hora ya pasó.
func (s *Server) advanceDueStops(ctx context.Context) int {
	due, err := s.store.CompleteDue(ctx, s.now().UTC())
	if err != nil {
		slog.Error("auto-avance", "err", err)
		return 0
	}
	n := 0
	for shipID, ids := range due {
		n += len(ids)
		if sh, err := s.store.ShipmentByID(ctx, shipID); err == nil {
			s.broadcast(ctx, sh, ids...)
		}
	}
	return n
}
