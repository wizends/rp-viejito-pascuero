package store

import (
	"os"
	"sync"
	"testing"
)

// En Vercel varias instancias arrancan juntas: crear el esquema en paralelo no debe fallar.
func TestConcurrentPostgresStartup(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requiere TEST_DATABASE_URL")
	}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			st, err := Open(url)
			if err != nil {
				errs <- err
				return
			}
			st.Close()
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("arranque concurrente: %v", err)
	}
}
