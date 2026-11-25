// Package config lee la configuración desde variables de entorno (y .env).
package config

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// DevSecret es la clave de desarrollo; en producción se exige otra.
const DevSecret = "solo-desarrollo-cambiar-en-produccion"

type Config struct {
	Environment string // development | production | test
	Addr        string
	DataDir     string
	// DatabaseURL (postgres://…) usa PostgreSQL; vacío = SQLite en DataDir.
	DatabaseURL string
	// RedisURL reparte los eventos en vivo entre instancias (Vercel); vacío = en memoria.
	RedisURL string
	// Serverless (Vercel): sin trabajos de fondo; las cartas se procesan al recibirlas.
	Serverless bool
	// CronSecret protege /api/cron/tick (Vercel lo envía como "Authorization: Bearer …").
	CronSecret  string
	CORSOrigins []string

	SecretKey      string
	AccessTTL      time.Duration
	RefreshTTL     time.Duration
	CookieSecure   bool
	CookieSameSite string // lax | strict

	RateWindow        time.Duration
	RateIP            int
	RateAuth          int
	RateUploads       int
	TrustForwardedFor bool

	MaxUploadMB   int
	RetentionDays int

	// IA de visión opcional (solo con consentimiento del padre): gemini | groq | openrouter | none
	VisionProvider   string
	GeminiAPIKey     string
	GeminiModel      string
	GroqAPIKey       string
	GroqModel        string
	OpenRouterAPIKey string
	OpenRouterModel  string
	VisionTimeout    time.Duration

	Timezone            string
	AutoAdvanceInterval time.Duration
}

func (c *Config) IsProduction() bool { return c.Environment == "production" }

// DBTarget es la URL de PostgreSQL o, si no hay, el archivo SQLite.
func (c *Config) DBTarget() string {
	if c.DatabaseURL != "" {
		return c.DatabaseURL
	}
	return filepath.Join(c.DataDir, "buzon.db")
}

// Load lee .env (si existe) y el entorno. Las variables de entorno reales tienen prioridad.
func Load() (*Config, error) {
	for _, f := range []string{".env", "../.env"} {
		loadDotEnv(f)
	}
	port := get("PORT", "8000")
	c := &Config{
		Environment: get("ENVIRONMENT", "development"),
		Addr:        get("ADDR", ":"+port),
		DataDir:     get("DATA_DIR", "data"),
		// Neon y Redis los inyectan las integraciones de Vercel con distintos nombres
		DatabaseURL:         first("DATABASE_URL", "POSTGRES_URL"),
		RedisURL:            first("REDIS_URL", "KV_URL"),
		Serverless:          getBool("SERVERLESS", get("VERCEL", "") == "1"),
		CronSecret:          get("CRON_SECRET", ""),
		CORSOrigins:         splitList(get("CORS_ORIGINS", "http://localhost:5173,http://localhost:5183,http://localhost:8080")),
		SecretKey:           get("SECRET_KEY", DevSecret),
		AccessTTL:           time.Duration(getInt("ACCESS_TOKEN_MINUTES", 15)) * time.Minute,
		RefreshTTL:          time.Duration(getInt("REFRESH_TOKEN_DAYS", 14)) * 24 * time.Hour,
		CookieSecure:        getBool("COOKIE_SECURE", false),
		CookieSameSite:      strings.ToLower(get("COOKIE_SAMESITE", "lax")),
		RateWindow:          time.Duration(getInt("RATE_LIMIT_WINDOW_SECONDS", 60)) * time.Second,
		RateIP:              getInt("RATE_LIMIT_IP", 120),
		RateAuth:            getInt("RATE_LIMIT_AUTH", 10),
		RateUploads:         getInt("RATE_LIMIT_UPLOADS", 12),
		TrustForwardedFor:   getBool("TRUST_FORWARDED_FOR", false),
		MaxUploadMB:         getInt("MAX_UPLOAD_MB", 10),
		RetentionDays:       getInt("RETENTION_DAYS", 60),
		VisionProvider:      strings.ToLower(get("VISION_PROVIDER", "none")),
		GeminiAPIKey:        get("GEMINI_API_KEY", ""),
		GeminiModel:         get("GEMINI_MODEL", "gemini-2.0-flash"),
		GroqAPIKey:          get("GROQ_API_KEY", ""),
		GroqModel:           get("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
		OpenRouterAPIKey:    get("OPENROUTER_API_KEY", ""),
		OpenRouterModel:     get("OPENROUTER_MODEL", "qwen/qwen2.5-vl-72b-instruct:free"),
		VisionTimeout:       time.Duration(getInt("VISION_TIMEOUT_SECONDS", 60)) * time.Second,
		Timezone:            get("TIMEZONE", "America/Santiago"),
		AutoAdvanceInterval: time.Duration(getInt("AUTO_ADVANCE_INTERVAL_SECONDS", 30)) * time.Second,
	}
	return c, c.validate()
}

func (c *Config) validate() error {
	switch c.Environment {
	case "development", "production", "test":
	default:
		return errors.New("ENVIRONMENT debe ser development, production o test")
	}
	if c.CookieSameSite != "lax" && c.CookieSameSite != "strict" {
		return errors.New("COOKIE_SAMESITE debe ser lax o strict")
	}
	switch c.VisionProvider {
	case "trocr", "":
		// el modelo local del backend anterior ya no existe: sin IA
		c.VisionProvider = "none"
	case "none", "gemini", "groq", "openrouter":
	default:
		return errors.New("VISION_PROVIDER debe ser none, gemini, groq u openrouter")
	}
	if c.IsProduction() {
		if c.SecretKey == DevSecret || len(c.SecretKey) < 32 {
			return errors.New("SECRET_KEY debe ser aleatoria y de al menos 32 caracteres")
		}
		if !c.CookieSecure {
			return errors.New("COOKIE_SECURE debe ser true en producción")
		}
	}
	return nil
}

func get(k, def string) string {
	if v, ok := os.LookupEnv(k); ok {
		return strings.TrimSpace(v)
	}
	return def
}

// first devuelve la primera variable definida y no vacía.
func first(keys ...string) string {
	for _, k := range keys {
		if v := get(k, ""); v != "" {
			return v
		}
	}
	return ""
}

func getInt(k string, def int) int {
	if n, err := strconv.Atoi(get(k, "")); err == nil {
		return n
	}
	return def
}

func getBool(k string, def bool) bool {
	if b, err := strconv.ParseBool(get(k, "")); err == nil {
		return b
	}
	return def
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// loadDotEnv carga KEY=VALUE sin pisar variables ya definidas.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		v = strings.Trim(strings.TrimSpace(v), `"'`)
		if _, set := os.LookupEnv(k); !set {
			_ = os.Setenv(k, v)
		}
	}
}
