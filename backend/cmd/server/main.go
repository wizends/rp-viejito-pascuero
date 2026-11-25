// Comando buzon: API del Buzón del Viejito Pascuero.
//
//	buzon               levanta el servidor (PORT, por defecto 8000)
//	buzon -healthcheck  consulta /api/health (para el healthcheck de Docker)
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // zonas horarias incluidas (la imagen no trae tzdata)

	"github.com/wizends/rp-viejito-pascuero/backend/internal/api"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/config"
	"github.com/wizends/rp-viejito-pascuero/backend/internal/store"
)

func main() {
	health := flag.Bool("healthcheck", false, "consulta /api/health y termina")
	flag.Parse()
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("configuración inválida", "err", err)
		os.Exit(1)
	}
	if *health {
		os.Exit(checkHealth(cfg.Addr))
	}

	if cfg.Serverless && !store.IsPostgres(cfg.DBTarget()) {
		// en Vercel el disco no persiste: sin PostgreSQL se perderían las cuentas y cartas
		slog.Error("falta DATABASE_URL: conecta Neon (Storage → Neon) al proyecto de Vercel")
		os.Exit(1)
	}
	st, err := store.Open(cfg.DBTarget())
	if err != nil {
		slog.Error("no se pudo abrir la base", "err", err)
		os.Exit(1)
	}
	defer st.Close()

	srv := api.New(cfg, st, api.Options{})
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	srv.Start(ctx)

	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	go func() {
		db := "sqlite"
		if store.IsPostgres(cfg.DBTarget()) {
			db = "postgres"
		}
		slog.Info("buzón abierto", "addr", cfg.Addr, "entorno", cfg.Environment, "ia", cfg.VisionProvider,
			"base", db, "redis", cfg.RedisURL != "", "serverless", cfg.Serverless)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("servidor", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdown)
	srv.Wait()
	slog.Info("buzón cerrado")
}

func checkHealth(addr string) int {
	host := addr
	if len(host) > 0 && host[0] == ':' {
		host = "127.0.0.1" + host
	}
	c := http.Client{Timeout: 3 * time.Second}
	res, err := c.Get(fmt.Sprintf("http://%s/api/health", host))
	if err != nil {
		return 1
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
