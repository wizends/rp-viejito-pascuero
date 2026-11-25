package vision

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestParseModelJSON(t *testing.T) {
	r, err := ParseModelJSON("```json\n{\"texto_original\": \"kiero\", \"regalos\": [{\"nombre\": \" auto. \"}], \"tono\": \"alegre\"}\n```")
	if err != nil {
		t.Fatal(err)
	}
	if r.Regalos[0].Nombre != "auto" || r.Tono != "alegre" || r.Confianza != 0.7 || r.TextoNormalizado != "kiero" {
		t.Fatalf("resultado inesperado: %+v", r)
	}
	for _, bad := range []string{`{"texto_original": "x", "tono": "furioso"}`, "sin json", `{"confianza": 3}`} {
		if _, err := ParseModelJSON(bad); !errors.Is(err, ErrVision) {
			t.Errorf("debería rechazar %q", bad)
		}
	}
}

func TestReadable(t *testing.T) {
	if Readable(&Result{TextoOriginal: "", Confianza: 0.9}, 0.5) {
		t.Error("sin texto no es legible")
	}
	if Readable(&Result{TextoOriginal: "hola", Confianza: 0.2}, 0.5) {
		t.Error("con poca confianza no es legible")
	}
	if !Readable(&Result{TextoOriginal: "hola", Confianza: 0.8}, 0.5) {
		t.Error("debería ser legible")
	}
}

func TestOpenAICompatReader(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer clave" {
			w.WriteHeader(401)
			return
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["model"] != "modelo-gratis" || !strings.Contains(mustJSON(body), "data:image/jpeg;base64,") {
			w.WriteHeader(400)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]any{
			"content": `{"texto_original": "Quiero un perrito", "regalos": [{"nombre": "perrito", "prioridad": 1}], "tono": "ilusionado", "confianza": 0.9}`,
		}}}})
	}))
	defer srv.Close()
	r := &OpenAICompat{Provider: "groq", URL: srv.URL, Key: "clave", Model: "modelo-gratis", Timeout: 5 * time.Second}
	res, err := r.Read(context.Background(), []byte{0xff, 0xd8, 0xff})
	if err != nil {
		t.Fatal(err)
	}
	if res.Regalos[0].Nombre != "perrito" || res.Confianza != 0.9 {
		t.Fatalf("resultado inesperado: %+v", res)
	}
	r.Key = "mala"
	if _, err := r.Read(context.Background(), []byte{1}); !errors.Is(err, ErrVision) {
		t.Fatal("debería fallar con 401")
	}
}

func TestGeminiReader(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1beta/models/gemini-x:generateContent" || r.Header.Get("x-goog-api-key") != "k" {
			w.WriteHeader(404)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{"content": map[string]any{
			"parts": []any{map[string]any{"text": `{"texto_original": "Hola", "confianza": 0.8}`}},
		}}}})
	}))
	defer srv.Close()
	g := &Gemini{Key: "k", Model: "gemini-x", BaseURL: srv.URL, Timeout: 5 * time.Second}
	res, err := g.Read(context.Background(), []byte{1})
	if err != nil || res.TextoOriginal != "Hola" {
		t.Fatalf("Gemini: %v %+v", err, res)
	}
}

func TestNewNeedsKey(t *testing.T) {
	if New(Config{Provider: "gemini"}) != nil || New(Config{Provider: "none", GeminiKey: "k"}) != nil {
		t.Fatal("sin proveedor o sin clave no hay lector")
	}
	if New(Config{Provider: "openrouter", OpenRouterKey: "k"}).Name() != "openrouter" {
		t.Fatal("debería elegir OpenRouter")
	}
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
