// Package vision lee cartas fotografiadas con un modelo de IA con capa gratuita.
//
// Es opcional: solo se usa si hay proveedor y API key configurados y el padre
// lo aceptó en su panel (la imagen sale del servidor). Sin IA, la carta queda
// solo como imagen.
package vision

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/wizends/rp-viejito-pascuero/backend/internal/text"
)

// Prompt pide transcripción literal, versión corregida, regalos y tono en JSON.
const Prompt = `Eres un duende transcriptor del Viejito Pascuero (Chile).
La imagen es la carta manuscrita de un niño o niña.
1. Transcribe LITERALMENTE el texto en "texto_original", respetando la ortografía original,
   los saltos de línea y los errores. No inventes palabras: usa [?] si algo es ilegible.
2. Escribe en "texto_normalizado" la misma carta con ortografía corregida, sin cambiar el sentido.
3. Extrae la lista de regalos pedidos en "regalos" como [{"nombre": str, "prioridad": int|null}],
   en el orden en que aparecen (prioridad 1 = primero).
4. "tono": uno de alegre, carinoso, ilusionado, timido, neutral.
5. "confianza": número entre 0 y 1 con tu seguridad sobre la transcripción.
Si la imagen no tiene texto legible (por ejemplo, es solo un dibujo), responde con
"texto_original" vacío y "confianza" 0.
No incluyas apellidos, direcciones, teléfonos, RUT ni colegios: reemplázalos por [dato protegido].
Responde SOLO con un objeto JSON con esas claves.`

// Result es lo que entrega el modelo, ya validado.
type Result struct {
	TextoOriginal    string      `json:"texto_original"`
	TextoNormalizado string      `json:"texto_normalizado"`
	Regalos          []text.Gift `json:"regalos"`
	Tono             string      `json:"tono"`
	Confianza        float64     `json:"confianza"`
}

// Reader es un proveedor de visión intercambiable.
type Reader interface {
	Name() string
	Read(ctx context.Context, jpeg []byte) (*Result, error)
}

// ErrVision envuelve fallas del proveedor (HTTP, formato, validación).
var ErrVision = errors.New("ia de visión")

func fail(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrVision, fmt.Sprintf(format, a...))
}

var (
	tones  = map[string]bool{"alegre": true, "carinoso": true, "ilusionado": true, "timido": true, "neutral": true}
	reJSON = regexp.MustCompile(`(?s)\{.*\}`)
)

// ParseModelJSON extrae y valida el JSON de la respuesta (tolera bloques de código markdown).
func ParseModelJSON(raw string) (*Result, error) {
	m := reJSON.FindString(raw)
	if m == "" {
		return nil, fail("el modelo no devolvió JSON")
	}
	var data struct {
		TextoOriginal    string   `json:"texto_original"`
		TextoNormalizado *string  `json:"texto_normalizado"`
		Tono             *string  `json:"tono"`
		Confianza        *float64 `json:"confianza"`
		Regalos          []struct {
			Nombre    string `json:"nombre"`
			Prioridad *int   `json:"prioridad"`
		} `json:"regalos"`
	}
	if err := json.Unmarshal([]byte(m), &data); err != nil {
		return nil, fail("JSON inválido del modelo: %v", err)
	}
	r := &Result{TextoOriginal: data.TextoOriginal, Tono: "neutral", Confianza: 0.7}
	r.TextoNormalizado = r.TextoOriginal
	if data.TextoNormalizado != nil {
		r.TextoNormalizado = *data.TextoNormalizado
	}
	if data.Tono != nil {
		if !tones[*data.Tono] {
			return nil, fail("tono desconocido %q", *data.Tono)
		}
		r.Tono = *data.Tono
	}
	if data.Confianza != nil {
		if *data.Confianza < 0 || *data.Confianza > 1 {
			return nil, fail("confianza fuera de rango")
		}
		r.Confianza = *data.Confianza
	}
	if len(data.Regalos) > 30 {
		data.Regalos = data.Regalos[:30]
	}
	for _, g := range data.Regalos {
		name := text.TidyGift(g.Nombre)
		if name == "" {
			continue
		}
		p := g.Prioridad
		if p != nil && (*p < 1 || *p > 10) {
			p = nil
		}
		r.Regalos = append(r.Regalos, text.Gift{Nombre: name, Prioridad: p})
	}
	return r, nil
}

// Readable indica si la lectura es usable (hay texto y el modelo confía en ella).
func Readable(r *Result, minConfidence float64) bool {
	return strings.TrimSpace(r.TextoOriginal) != "" && r.Confianza >= minConfidence
}

var client = &http.Client{}

func post(ctx context.Context, url string, headers map[string]string, body any, timeout time.Duration) ([]byte, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(buf))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, fail("sin respuesta: %v", err)
	}
	defer res.Body.Close()
	out, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, fail("respuesta cortada")
	}
	if res.StatusCode != http.StatusOK {
		return nil, fail("respondió %d", res.StatusCode)
	}
	return out, nil
}

// Gemini usa la API de Google AI Studio (capa gratuita).
type Gemini struct {
	Key, Model, BaseURL string
	Timeout             time.Duration
}

func (g *Gemini) Name() string { return "gemini" }

func (g *Gemini) Read(ctx context.Context, img []byte) (*Result, error) {
	base := g.BaseURL
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}
	body := map[string]any{
		"contents": []any{map[string]any{"parts": []any{
			map[string]any{"text": Prompt},
			map[string]any{"inline_data": map[string]any{"mime_type": "image/jpeg", "data": base64.StdEncoding.EncodeToString(img)}},
		}}},
		"generationConfig": map[string]any{"responseMimeType": "application/json", "temperature": 0.1},
	}
	raw, err := post(ctx, base+"/v1beta/models/"+g.Model+":generateContent", map[string]string{"x-goog-api-key": g.Key}, body, g.Timeout)
	if err != nil {
		return nil, err
	}
	var res struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(raw, &res) != nil || len(res.Candidates) == 0 || len(res.Candidates[0].Content.Parts) == 0 {
		return nil, fail("respuesta inesperada de Gemini")
	}
	return ParseModelJSON(res.Candidates[0].Content.Parts[0].Text)
}

// OpenAICompat sirve para Groq y OpenRouter (API tipo chat/completions con imágenes).
type OpenAICompat struct {
	Provider, URL, Key, Model string
	Timeout                   time.Duration
}

func (o *OpenAICompat) Name() string { return o.Provider }

func (o *OpenAICompat) Read(ctx context.Context, img []byte) (*Result, error) {
	body := map[string]any{
		"model":       o.Model,
		"temperature": 0.1,
		"messages": []any{map[string]any{"role": "user", "content": []any{
			map[string]any{"type": "text", "text": Prompt},
			map[string]any{"type": "image_url", "image_url": map[string]any{"url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(img)}},
		}}},
	}
	raw, err := post(ctx, o.URL, map[string]string{"Authorization": "Bearer " + o.Key}, body, o.Timeout)
	if err != nil {
		return nil, err
	}
	var res struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(raw, &res) != nil || len(res.Choices) == 0 {
		return nil, fail("respuesta inesperada de %s", o.Provider)
	}
	return ParseModelJSON(res.Choices[0].Message.Content)
}

// Config mínima para elegir proveedor (evita depender del paquete config).
type Config struct {
	Provider                       string
	GeminiKey, GeminiModel         string
	GroqKey, GroqModel             string
	OpenRouterKey, OpenRouterModel string
	Timeout                        time.Duration
}

// New devuelve el lector configurado o nil si no hay proveedor o falta la API key.
func New(c Config) Reader {
	switch c.Provider {
	case "gemini":
		if c.GeminiKey != "" {
			return &Gemini{Key: c.GeminiKey, Model: c.GeminiModel, Timeout: c.Timeout}
		}
	case "groq":
		if c.GroqKey != "" {
			return &OpenAICompat{Provider: "groq", URL: "https://api.groq.com/openai/v1/chat/completions", Key: c.GroqKey, Model: c.GroqModel, Timeout: c.Timeout}
		}
	case "openrouter":
		if c.OpenRouterKey != "" {
			return &OpenAICompat{Provider: "openrouter", URL: "https://openrouter.ai/api/v1/chat/completions", Key: c.OpenRouterKey, Model: c.OpenRouterModel, Timeout: c.Timeout}
		}
	}
	return nil
}
