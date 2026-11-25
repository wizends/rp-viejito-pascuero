package api

import (
	"bytes"
	"context"
	"encoding/json"
	"image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/config"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/text"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/vision"
)

// ---------- entorno de prueba ----------

type textGift = text.Gift

type fakeVision struct {
	mu    sync.Mutex
	calls int
	res   *vision.Result
	err   error
}

func (f *fakeVision) Name() string { return "falsa" }
func (f *fakeVision) Read(context.Context, []byte) (*vision.Result, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	return f.res, f.err
}

type env struct {
	t      *testing.T
	srv    *Server
	http   *httptest.Server
	vision *fakeVision
	now    time.Time
}

func testConfig(dir string) *config.Config {
	return &config.Config{
		Environment: "test", DataDir: dir, CORSOrigins: []string{"http://localhost:5173"},
		SecretKey: "secreto-de-prueba-con-mas-de-32-caracteres", AccessTTL: 15 * time.Minute,
		RefreshTTL: 14 * 24 * time.Hour, CookieSameSite: "lax",
		RateWindow: time.Minute, RateIP: 10_000, RateAuth: 10_000, RateUploads: 10_000,
		MaxUploadMB: 10, RetentionDays: 60, VisionProvider: "none", VisionTimeout: 5 * time.Second,
		Timezone: "America/Santiago",
	}
}

func newEnv(t *testing.T, mod ...func(*config.Config)) *env {
	t.Helper()
	dir := t.TempDir()
	cfg := testConfig(dir)
	for _, m := range mod {
		m(cfg)
	}
	st, err := store.Open(filepath.Join(dir, "buzon.db"))
	if err != nil {
		t.Fatal(err)
	}
	e := &env{t: t, vision: &fakeVision{}, now: time.Date(2026, 11, 24, 12, 0, 0, 0, time.UTC)}
	e.srv = New(cfg, st, Options{Vision: e.vision, Inline: true, Now: func() time.Time { return e.now }})
	e.http = httptest.NewServer(e.srv.Handler())
	t.Cleanup(func() { e.http.Close(); st.Close() })
	return e
}

type client struct {
	e   *env
	c   *http.Client
	jar *cookiejar.Jar
}

func (e *env) client() *client {
	jar, _ := cookiejar.New(nil)
	return &client{e: e, c: &http.Client{Jar: jar}, jar: jar}
}

func (c *client) cookie(name string) string {
	u, _ := url.Parse(c.e.http.URL + "/api/auth/x") // cubre las rutas "/" y "/api/auth"
	for _, k := range c.jar.Cookies(u) {
		if k.Name == name {
			return k.Value
		}
	}
	return ""
}

type resp struct {
	status int
	body   []byte
	header http.Header
}

func (r resp) json(t *testing.T) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(r.body, &m); err != nil {
		t.Fatalf("respuesta no es JSON (%d): %s", r.status, r.body)
	}
	return m
}

func (r resp) list(t *testing.T) []any {
	t.Helper()
	var l []any
	if err := json.Unmarshal(r.body, &l); err != nil {
		t.Fatalf("respuesta no es una lista (%d): %s", r.status, r.body)
	}
	return l
}

func (c *client) do(method, path string, body any, csrf bool) resp {
	c.e.t.Helper()
	var rdr io.Reader
	ctype := ""
	switch b := body.(type) {
	case nil:
	case *multipartBody:
		rdr, ctype = &b.buf, b.ctype
	default:
		raw, _ := json.Marshal(b)
		rdr, ctype = bytes.NewReader(raw), "application/json"
	}
	req, _ := http.NewRequest(method, c.e.http.URL+path, rdr)
	if ctype != "" {
		req.Header.Set("Content-Type", ctype)
	}
	if csrf {
		req.Header.Set("X-CSRF-Token", c.cookie("vp_csrf"))
	}
	res, err := c.c.Do(req)
	if err != nil {
		c.e.t.Fatal(err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	return resp{status: res.StatusCode, body: data, header: res.Header}
}

func (c *client) get(path string) resp             { return c.do("GET", path, nil, false) }
func (c *client) post(path string, body any) resp  { return c.do("POST", path, body, true) }
func (c *client) patch(path string, body any) resp { return c.do("PATCH", path, body, true) }
func (c *client) put(path string, body any) resp   { return c.do("PUT", path, body, true) }
func (c *client) delete(path string) resp          { return c.do("DELETE", path, nil, true) }

func (e *env) parent(email string) *client {
	c := e.client()
	r := c.post("/api/auth/register", map[string]any{"email": email, "password": "clave-larga-123", "display_name": "Mamá"})
	if r.status != 201 {
		e.t.Fatalf("registro: %d %s", r.status, r.body)
	}
	return c
}

func (c *client) login(email string) {
	r := c.post("/api/auth/login", map[string]any{"email": email, "password": "clave-larga-123"})
	if r.status != 200 {
		c.e.t.Fatalf("login: %d %s", r.status, r.body)
	}
}

func (c *client) child(nick string) string {
	r := c.post("/api/children", map[string]any{"nickname": nick, "age": 7})
	if r.status != 201 {
		c.e.t.Fatalf("niño: %d %s", r.status, r.body)
	}
	return r.json(c.e.t)["id"].(string)
}

type multipartBody struct {
	buf   bytes.Buffer
	ctype string
}

func upload(fields map[string]string, file []byte) *multipartBody {
	m := &multipartBody{}
	w := multipart.NewWriter(&m.buf)
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}
	fw, _ := w.CreateFormFile("file", "carta.png")
	_, _ = fw.Write(file)
	_ = w.Close()
	m.ctype = w.FormDataContentType()
	return m
}

func testJPEG(t *testing.T) []byte {
	t.Helper()
	data, err := os.ReadFile("../imaging/testdata/carta_con_gps.jpg")
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// ---------- sesión ----------

func TestHealthAndHeaders(t *testing.T) {
	e := newEnv(t)
	r := e.client().get("/api/health")
	if r.status != 200 || r.json(t)["estado"] != "jo jo jo" {
		t.Fatalf("health: %d %s", r.status, r.body)
	}
	for _, h := range []string{"X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Referrer-Policy"} {
		if r.header.Get(h) == "" {
			t.Errorf("falta la cabecera %s", h)
		}
	}
}

func TestRegisterLoginRefreshLogout(t *testing.T) {
	e := newEnv(t)
	c := e.parent("papa@ejemplo.cl")
	if me := c.get("/api/auth/me").json(t); me["email"] != "papa@ejemplo.cl" || me["allow_external_ai"] != false {
		t.Fatalf("me: %v", me)
	}
	if r := c.post("/api/auth/register", map[string]any{"email": "PAPA@ejemplo.cl", "password": "clave-larga-123", "display_name": "x"}); r.status != 409 {
		t.Fatalf("correo repetido: %d", r.status)
	}
	if r := e.client().post("/api/auth/register", map[string]any{"email": "a@b.cl", "password": "corta", "display_name": "x"}); r.status != 422 {
		t.Fatalf("clave corta: %d", r.status)
	}
	if r := e.client().post("/api/auth/login", map[string]any{"email": "papa@ejemplo.cl", "password": "equivocada"}); r.status != 401 {
		t.Fatalf("clave incorrecta: %d", r.status)
	}

	// rotación: el refresh usado ya no sirve
	old := c.cookie("vp_refresh")
	if old == "" {
		t.Fatal("no hay cookie de refresh")
	}
	if r := c.post("/api/auth/refresh", nil); r.status != 200 {
		t.Fatalf("refresh: %d %s", r.status, r.body)
	}
	thief := e.client()
	u, _ := url.Parse(e.http.URL + "/api/auth/")
	thief.jar.SetCookies(u, []*http.Cookie{{Name: "vp_refresh", Value: old, Path: "/api/auth"}})
	if r := thief.post("/api/auth/refresh", nil); r.status != 401 {
		t.Fatalf("reuso del refresh: %d", r.status)
	}

	if r := c.post("/api/auth/logout", nil); r.status != 204 {
		t.Fatalf("logout: %d", r.status)
	}
	if r := c.get("/api/auth/me"); r.status != 401 {
		t.Fatalf("tras logout: %d", r.status)
	}
}

func TestCSRFIsRequired(t *testing.T) {
	e := newEnv(t)
	c := e.parent("mama@ejemplo.cl")
	if r := c.do("PATCH", "/api/auth/me", map[string]any{"display_name": "Otra"}, false); r.status != 403 {
		t.Fatalf("sin CSRF: %d", r.status)
	}
	r := c.patch("/api/auth/me", map[string]any{"display_name": "Otra", "allow_external_ai": true})
	if r.status != 200 || r.json(t)["allow_external_ai"] != true || r.json(t)["display_name"] != "Otra" {
		t.Fatalf("con CSRF: %d %s", r.status, r.body)
	}
}

func TestOwnershipIsolation(t *testing.T) {
	e := newEnv(t)
	a := e.parent("a@ejemplo.cl")
	b := e.parent("b@ejemplo.cl")
	kid := a.child("Sofi")
	letter := a.post("/api/letters", map[string]any{"child_id": kid, "deseos": []string{"pelota"}}).json(t)["id"].(string)
	sh := a.get("/api/children/" + kid + "/shipment").json(t)
	shID := sh["id"].(string)
	a.post("/api/shipments/"+shID+"/stops", map[string]any{"nombre": "Taller"})
	stopID := a.get("/api/children/" + kid + "/shipment").json(t)["stops"].([]any)[0].(map[string]any)["id"].(string)

	for _, r := range []resp{
		b.patch("/api/children/"+kid, map[string]any{"nickname": "x"}),
		b.get("/api/letters/" + letter),
		b.get("/api/letters/" + letter + "/image"),
		b.delete("/api/letters/" + letter),
		b.get("/api/children/" + kid + "/shipment"),
		b.patch("/api/shipments/"+shID, map[string]any{"arrival_at": "2026-12-25T03:00:00Z"}),
		b.patch("/api/stops/"+stopID, map[string]any{"completed": true}),
		b.delete("/api/stops/" + stopID),
		b.post("/api/letters", map[string]any{"child_id": kid, "deseos": []string{"x"}}),
	} {
		if r.status != 404 {
			t.Errorf("acceso ajeno respondió %d: %s", r.status, r.body)
		}
	}
	if l := b.get("/api/letters").list(t); len(l) != 0 {
		t.Fatal("ve cartas ajenas")
	}
}

func TestChildrenCRUDAndLimit(t *testing.T) {
	e := newEnv(t)
	c := e.parent("c@ejemplo.cl")
	id := c.child("Tomi")
	r := c.patch("/api/children/"+id, map[string]any{"age": nil, "avatar": "reno_nieve"})
	if m := r.json(t); m["age"] != nil || m["avatar"] != "reno_nieve" || m["nickname"] != "Tomi" {
		t.Fatalf("patch: %v", m)
	}
	if r := c.post("/api/children", map[string]any{"nickname": "x", "avatar": "dragon"}); r.status != 422 {
		t.Fatalf("avatar inválido: %d", r.status)
	}
	for i := 0; i < 11; i++ {
		c.child("n")
	}
	if r := c.post("/api/children", map[string]any{"nickname": "13"}); r.status != 400 {
		t.Fatalf("límite de 12: %d", r.status)
	}
	if r := c.delete("/api/children/" + id); r.status != 204 {
		t.Fatalf("borrar: %d", r.status)
	}
	if n := len(c.get("/api/children").list(t)); n != 11 {
		t.Fatalf("quedan %d", n)
	}
}

// ---------- cartas ----------

func TestWrittenLetterIsReadAndMasked(t *testing.T) {
	e := newEnv(t)
	c := e.parent("d@ejemplo.cl")
	kid := c.child("Sofi")
	r := c.post("/api/letters", map[string]any{
		"child_id": kid, "deseos": []string{"bicicleta", "  ", "libro de dinosaurios"},
		"mensaje": "Hola Viejito! mi fono es 9 1234 5678",
	})
	if r.status != 202 {
		t.Fatalf("crear: %d %s", r.status, r.body)
	}
	l := c.get("/api/letters/" + r.json(t)["id"].(string)).json(t)
	if l["status"] != "leida" || l["metodo"] != "escrita" || l["pii_masked"] != true {
		t.Fatalf("carta: %v", l)
	}
	gifts := l["gifts"].([]any)
	if len(gifts) != 2 || gifts[0].(map[string]any)["nombre"] != "bicicleta" {
		t.Fatalf("regalos: %v", gifts)
	}
	if strings.Contains(l["texto_original"].(string), "1234 5678") || strings.Contains(l["mensaje"].(string), "1234 5678") {
		t.Fatal("se filtró el teléfono")
	}
	if r := c.post("/api/letters", map[string]any{"child_id": kid, "deseos": []string{" "}, "mensaje": " "}); r.status != 422 {
		t.Fatalf("carta vacía: %d", r.status)
	}
}

func TestWrittenLetterExtractsGiftsFromMessage(t *testing.T) {
	e := newEnv(t)
	c := e.parent("e@ejemplo.cl")
	kid := c.child("Ana")
	id := c.post("/api/letters", map[string]any{"child_id": kid, "mensaje": "Querido viejito, quiero una muñeca y un puzzle."}).json(t)["id"].(string)
	gifts := c.get("/api/letters/" + id).json(t)["gifts"].([]any)
	if len(gifts) != 2 || gifts[1].(map[string]any)["nombre"] != "puzzle" {
		t.Fatalf("regalos: %v", gifts)
	}
}

func TestPhotoLetterKeepsOnlyTheImage(t *testing.T) {
	e := newEnv(t)
	c := e.parent("f@ejemplo.cl")
	kid := c.child("Leo")
	r := c.post("/api/letters/upload", upload(map[string]string{"child_id": kid, "mensaje": "dibujé un reno"}, testJPEG(t)))
	if r.status != 202 {
		t.Fatalf("subir: %d %s", r.status, r.body)
	}
	id := r.json(t)["id"].(string)
	l := c.get("/api/letters/" + id).json(t)
	if l["status"] != "leida" || l["has_image"] != true || l["metodo"] != nil || l["texto_original"] != "" {
		t.Fatalf("carta foto: %v", l)
	}
	if e.vision.calls != 0 {
		t.Fatal("sin consentimiento no se debe llamar a la IA")
	}
	img := c.get("/api/letters/" + id + "/image")
	if img.status != 200 || img.header.Get("Content-Type") != "image/jpeg" || img.header.Get("Cache-Control") != "private, no-store" {
		t.Fatalf("imagen: %d %v", img.status, img.header)
	}
	if bytes.Contains(img.body, []byte("Exif")) {
		t.Fatal("la imagen servida conserva EXIF")
	}
	if _, err := jpeg.Decode(bytes.NewReader(img.body)); err != nil {
		t.Fatal("la imagen servida no es JPEG")
	}

	// el padre puede transcribirla a mano; la imagen se conserva
	l = c.patch("/api/letters/"+id, map[string]any{
		"texto_original": "Quiero un trompo", "gifts": []any{map[string]any{"nombre": "trompo", "marcado": true}},
	}).json(t)
	if l["metodo"] != "manual" || l["has_image"] != true || l["gifts"].([]any)[0].(map[string]any)["marcado"] != true {
		t.Fatalf("transcripción: %v", l)
	}

	// al borrar la carta se borra el archivo
	files, _ := os.ReadDir(e.srv.cfg.UploadDir())
	if len(files) != 1 {
		t.Fatalf("archivos guardados: %d", len(files))
	}
	if r := c.delete("/api/letters/" + id); r.status != 204 {
		t.Fatalf("borrar: %d", r.status)
	}
	if files, _ := os.ReadDir(e.srv.cfg.UploadDir()); len(files) != 0 {
		t.Fatal("quedó la imagen en disco")
	}
}

func TestPhotoLetterWithAIAndConsent(t *testing.T) {
	e := newEnv(t)
	p := 1
	e.vision.res = &vision.Result{TextoOriginal: "Quiero un perrito. Mi rut es 21.345.678-9", TextoNormalizado: "Quiero un perrito.",
		Regalos: []textGift{{Nombre: "perrito", Prioridad: &p}}, Tono: "ilusionado", Confianza: 0.9}
	c := e.parent("g@ejemplo.cl")
	c.patch("/api/auth/me", map[string]any{"allow_external_ai": true})
	kid := c.child("Bea")
	id := c.post("/api/letters/upload", upload(map[string]string{"child_id": kid}, testJPEG(t))).json(t)["id"].(string)
	l := c.get("/api/letters/" + id).json(t)
	if l["status"] != "leida" || l["metodo"] != "ia" || l["tono"] != "ilusionado" || l["has_image"] != true {
		t.Fatalf("carta con IA: %v", l)
	}
	if strings.Contains(l["texto_original"].(string), "21.345.678-9") || l["pii_masked"] != true {
		t.Fatal("no enmascaró lo que leyó la IA")
	}
	if l["gifts"].([]any)[0].(map[string]any)["nombre"] != "perrito" || e.vision.calls != 1 {
		t.Fatalf("regalos IA: %v (llamadas %d)", l["gifts"], e.vision.calls)
	}

	// dibujo sin texto: la IA no inventa, queda solo la imagen
	e.vision.res = &vision.Result{TextoOriginal: "", Confianza: 0}
	id = c.post("/api/letters/upload", upload(map[string]string{"child_id": kid}, testJPEG(t))).json(t)["id"].(string)
	if l := c.get("/api/letters/" + id).json(t); l["status"] != "leida" || l["metodo"] != nil || len(l["gifts"].([]any)) != 0 {
		t.Fatalf("dibujo: %v", l)
	}
	// si la IA falla, la carta igual llega
	e.vision.res, e.vision.err = nil, vision.ErrVision
	id = c.post("/api/letters/upload", upload(map[string]string{"child_id": kid}, testJPEG(t))).json(t)["id"].(string)
	if l := c.get("/api/letters/" + id).json(t); l["status"] != "leida" || l["has_image"] != true {
		t.Fatalf("IA caída: %v", l)
	}
}

func TestUploadRejectsBadFiles(t *testing.T) {
	e := newEnv(t, func(c *config.Config) { c.MaxUploadMB = 1 })
	c := e.parent("h@ejemplo.cl")
	kid := c.child("Max")
	if r := c.post("/api/letters/upload", upload(map[string]string{"child_id": kid}, []byte("<html>no soy imagen</html>"))); r.status != 415 {
		t.Fatalf("falsa imagen: %d %s", r.status, r.body)
	}
	if r := c.post("/api/letters/upload", upload(map[string]string{"child_id": kid}, append([]byte("\xff\xd8\xff"), make([]byte, 3<<20)...))); r.status != 400 {
		t.Fatalf("muy grande: %d %s", r.status, r.body)
	}
	if r := c.post("/api/letters/upload", upload(map[string]string{"child_id": "otro"}, testJPEG(t))); r.status != 404 {
		t.Fatalf("niño ajeno: %d", r.status)
	}
	if files, _ := os.ReadDir(e.srv.cfg.UploadDir()); len(files) != 0 {
		t.Fatal("guardó archivos rechazados")
	}
}

func TestReprocessingIsANoop(t *testing.T) {
	e := newEnv(t)
	c := e.parent("i@ejemplo.cl")
	kid := c.child("Pía")
	id := c.post("/api/letters", map[string]any{"child_id": kid, "deseos": []string{"tren"}}).json(t)["id"].(string)
	before := c.get("/api/letters/" + id).body
	e.srv.processLetter(context.Background(), id)
	if after := c.get("/api/letters/" + id).body; !bytes.Equal(before, after) {
		t.Fatal("reprocesar cambió la carta")
	}
}

func TestRetentionPurgesOldImages(t *testing.T) {
	e := newEnv(t)
	c := e.parent("j@ejemplo.cl")
	kid := c.child("Gabi")
	id := c.post("/api/letters/upload", upload(map[string]string{"child_id": kid}, testJPEG(t))).json(t)["id"].(string)
	e.now = e.now.AddDate(0, 0, 61)
	e.srv.purgeExpiredImages(context.Background())
	c.login("j@ejemplo.cl") // el reloj avanzó: la sesión anterior venció
	if l := c.get("/api/letters/" + id).json(t); l["has_image"] != false {
		t.Fatal("no borró la imagen vencida")
	}
	if r := c.get("/api/letters/" + id + "/image"); r.status != 404 {
		t.Fatalf("imagen vencida: %d", r.status)
	}
}

// ---------- trayecto ----------

func TestShipmentTemplatesTrackingAndAutoAdvance(t *testing.T) {
	e := newEnv(t)
	c := e.parent("k@ejemplo.cl")
	kid := c.child("Isi")
	sh := c.get("/api/children/" + kid + "/shipment").json(t)
	// Nochebuena: 25 de diciembre 00:00 en Chile (UTC-3 en verano)
	if sh["arrival_at"] != "2026-12-25T03:00:00Z" {
		t.Fatalf("llegada por defecto: %v", sh["arrival_at"])
	}
	id, code := sh["id"].(string), sh["share_code"].(string)
	sh = c.post("/api/shipments/"+id+"/stops/templates", nil).json(t)
	stops := sh["stops"].([]any)
	if len(stops) != 9 || stops[8].(map[string]any)["eta"] != "2026-12-25T03:00:00Z" {
		t.Fatalf("plantillas: %d %v", len(stops), stops[8])
	}

	// reordenar exige todas las paradas una vez
	ids := make([]string, len(stops))
	for i, s := range stops {
		ids[len(stops)-1-i] = s.(map[string]any)["id"].(string)
	}
	if r := c.put("/api/shipments/"+id+"/stops/order", map[string]any{"ids": ids[:3]}); r.status != 422 {
		t.Fatalf("orden incompleto: %d", r.status)
	}
	sh = c.put("/api/shipments/"+id+"/stops/order", map[string]any{"ids": ids}).json(t)
	if sh["stops"].([]any)[0].(map[string]any)["nombre"] != "¡Bajo el árbol!" {
		t.Fatal("no reordenó")
	}

	// vista pública: sin datos del padre
	pub := e.client().get("/api/tracking/" + code)
	if pub.status != 200 || pub.header.Get("Cache-Control") != "no-store" {
		t.Fatalf("seguimiento: %d", pub.status)
	}
	view := pub.json(t)
	if view["nickname"] != "Isi" || view["child_id"] != nil || view["share_code"] != nil || view["server_time"] == nil {
		t.Fatalf("vista pública: %v", view)
	}
	if r := e.client().get("/api/tracking/no-existe"); r.status != 404 {
		t.Fatalf("código inexistente: %d", r.status)
	}

	// auto-avance: a las 12 h de la llegada, las paradas de 240..12 h quedan completas
	e.now = time.Date(2026, 12, 24, 15, 0, 0, 0, time.UTC)
	if n := e.srv.advanceDueStops(context.Background()); n != 5 {
		t.Fatalf("auto-avance completó %d", n)
	}
	if n := e.srv.advanceDueStops(context.Background()); n != 0 {
		t.Fatal("el auto-avance no es idempotente")
	}
	c.login("k@ejemplo.cl") // el reloj avanzó: la sesión anterior venció

	// marcar y desmarcar a mano, borrar y compactar posiciones
	first := c.get("/api/children/" + kid + "/shipment").json(t)["stops"].([]any)[0].(map[string]any)["id"].(string)
	if s := c.patch("/api/stops/"+first, map[string]any{"completed": true}).json(t)["stops"].([]any)[0].(map[string]any); s["completed_at"] == nil {
		t.Fatal("no marcó la parada")
	}
	sh = c.delete("/api/stops/" + first).json(t)
	if st := sh["stops"].([]any); len(st) != 8 || st[0].(map[string]any)["position"] != float64(0) || st[7].(map[string]any)["position"] != float64(7) {
		t.Fatalf("posiciones tras borrar: %v", st)
	}
	if r := c.post("/api/shipments/"+id+"/stops", map[string]any{"nombre": "x", "lat": 120}); r.status != 422 {
		t.Fatalf("latitud inválida: %d", r.status)
	}
}

func TestWebSockets(t *testing.T) {
	e := newEnv(t)
	c := e.parent("l@ejemplo.cl")
	kid := c.child("Noa")
	sh := c.get("/api/children/" + kid + "/shipment").json(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	wsURL := "ws" + strings.TrimPrefix(e.http.URL, "http")

	conn, _, err := websocket.Dial(ctx, wsURL+"/ws/tracking/"+sh["share_code"].(string), &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": {"http://localhost:5173"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()
	if err := conn.Write(ctx, websocket.MessageText, []byte("ping")); err != nil {
		t.Fatal(err)
	}
	if _, msg, _ := conn.Read(ctx); !strings.Contains(string(msg), `"pong"`) {
		t.Fatalf("esperaba pong: %s", msg)
	}
	c.post("/api/shipments/"+sh["id"].(string)+"/stops", map[string]any{"nombre": "Taller"})
	if _, msg, _ := conn.Read(ctx); !strings.Contains(string(msg), `"tracking.updated"`) || !strings.Contains(string(msg), "Taller") {
		t.Fatalf("esperaba tracking.updated: %s", msg)
	}

	// cartas: sin sesión se cierra con 4401; con sesión recibe los estados
	anon, _, err := websocket.Dial(ctx, wsURL+"/ws/letters", nil)
	if err == nil {
		_, _, rerr := anon.Read(ctx)
		if websocket.CloseStatus(rerr) != 4401 {
			t.Fatalf("sin sesión: %v", rerr)
		}
	}
	u, _ := url.Parse(e.http.URL)
	h := http.Header{"Origin": {"http://localhost:5173"}}
	for _, k := range c.jar.Cookies(u) {
		h.Add("Cookie", k.Name+"="+k.Value)
	}
	letters, _, err := websocket.Dial(ctx, wsURL+"/ws/letters", &websocket.DialOptions{HTTPHeader: h})
	if err != nil {
		t.Fatal(err)
	}
	defer letters.CloseNow()
	for e.srv.Hub().Count("user:"+c.get("/api/auth/me").json(t)["id"].(string)) == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	c.post("/api/letters", map[string]any{"child_id": kid, "deseos": []string{"cometa"}})
	var statuses []string
	for len(statuses) < 2 {
		_, msg, err := letters.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var m struct {
			Event string            `json:"event"`
			Data  map[string]string `json:"data"`
		}
		_ = json.Unmarshal(msg, &m)
		if m.Event == "letter.status" {
			statuses = append(statuses, m.Data["status"])
		}
	}
	if statuses[0] != "leyendo" || statuses[1] != "leida" {
		t.Fatalf("estados: %v", statuses)
	}

	// origen no permitido
	bad, _, err := websocket.Dial(ctx, wsURL+"/ws/tracking/"+sh["share_code"].(string), &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": {"https://malo.example"}},
	})
	if err == nil {
		if _, _, rerr := bad.Read(ctx); websocket.CloseStatus(rerr) != 4403 {
			t.Fatalf("origen malo: %v", rerr)
		}
	}
}

// ---------- límites ----------

func TestRateLimitsAndForwardedFor(t *testing.T) {
	e := newEnv(t, func(c *config.Config) { c.RateAuth = 3 })
	c := e.client()
	for i := 0; i < 3; i++ {
		c.post("/api/auth/login", map[string]any{"email": "x@y.cl", "password": "z"})
	}
	r := c.post("/api/auth/login", map[string]any{"email": "x@y.cl", "password": "z"})
	if r.status != 429 || r.header.Get("Retry-After") != "60" {
		t.Fatalf("límite de auth: %d", r.status)
	}

	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "76.76.21.1:1234"
	req.Header.Set("X-Forwarded-For", "200.1.2.3, 76.76.21.1")
	if ip := e.srv.clientIP(req); ip != "76.76.21.1" {
		t.Fatalf("sin TRUST_FORWARDED_FOR: %s", ip)
	}
	e.srv.cfg.TrustForwardedFor = true
	if ip := e.srv.clientIP(req); ip != "200.1.2.3" {
		t.Fatalf("con TRUST_FORWARDED_FOR: %s", ip)
	}
}

func TestCORSPreflight(t *testing.T) {
	e := newEnv(t)
	req, _ := http.NewRequest("OPTIONS", e.http.URL+"/api/children", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "POST")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 || res.Header.Get("Access-Control-Allow-Origin") != "http://localhost:5173" || res.Header.Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("preflight: %d %v", res.StatusCode, res.Header)
	}
}
