package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

// Mensajes comunes (mismos textos que la API anterior).
const (
	msgNotFound = "No encontramos eso en el Polo Norte."
	msgNoAuth   = "Necesitas tu credencial de ayudante."
)

// apiError se responde como {"detail": "..."}, igual que FastAPI.
type apiError struct {
	Status int
	Detail string
}

func (e *apiError) Error() string { return e.Detail }

func errf(status int, format string, a ...any) *apiError {
	return &apiError{Status: status, Detail: fmt.Sprintf(format, a...)}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, err error) {
	var ae *apiError
	if errors.As(err, &ae) {
		writeJSON(w, ae.Status, map[string]string{"detail": ae.Detail})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"detail": "Algo se enredó en el taller."})
}

// decode lee JSON (máx. 1 MB). Campos extra se ignoran, como en Pydantic.
func decode(r *http.Request, v any) error {
	body := http.MaxBytesReader(nil, r.Body, 1<<20)
	data, err := io.ReadAll(body)
	if err != nil {
		return errf(http.StatusRequestEntityTooLarge, "El contenido es demasiado grande.")
	}
	if err := json.Unmarshal(data, v); err != nil {
		return errf(http.StatusUnprocessableEntity, "Revisa los datos del formulario.")
	}
	return nil
}

// Opt distingue "no vino" de "vino null" en los PATCH.
type Opt[T any] struct {
	Set  bool
	Null bool
	V    T
}

func (o *Opt[T]) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		o.Null = true
		return nil
	}
	return json.Unmarshal(b, &o.V)
}

// Has es true si vino con un valor (no null).
func (o Opt[T]) Has() bool { return o.Set && !o.Null }

// ---------- validación ----------

func invalid(format string, a ...any) *apiError {
	return errf(http.StatusUnprocessableEntity, format, a...)
}

func runeLen(s string) int { return utf8.RuneCountInString(s) }

// checkLen valida largo en caracteres y devuelve el texto recortado de espacios.
func checkLen(field, v string, minLen, maxLen int) (string, error) {
	if n := runeLen(v); n < minLen || n > maxLen {
		return "", invalid("El campo %s debe tener entre %d y %d caracteres.", field, minLen, maxLen)
	}
	return v, nil
}

func validEmail(e string) bool {
	if len(e) > 254 || strings.ContainsAny(e, " \t\r\n") {
		return false
	}
	local, domain, ok := strings.Cut(e, "@")
	if !ok || local == "" || strings.Contains(domain, "@") {
		return false
	}
	dot := strings.LastIndex(domain, ".")
	return dot > 0 && dot < len(domain)-2
}

// parseTime acepta ISO 8601 con zona; sin zona se asume UTC.
func parseTime(s string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.999999999", "2006-01-02T15:04", "2006-01-02"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, invalid("Fecha inválida: %s", s)
}

// jsonTime es una fecha ISO que se decodifica con parseTime.
type jsonTime struct{ time.Time }

func (t *jsonTime) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	v, err := parseTime(s)
	if err != nil {
		return err
	}
	t.Time = v
	return nil
}
