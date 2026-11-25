package security

import (
	"strings"
	"testing"
	"time"
)

func TestPasswordHashAndVerify(t *testing.T) {
	h, err := HashPassword("clave-super-secreta")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(h, "$argon2id$v=19$m=65536,t=3,p=4$") {
		t.Fatalf("formato PHC inesperado: %s", h)
	}
	if !VerifyPassword(h, "clave-super-secreta") {
		t.Fatal("no verifica la clave correcta")
	}
	if VerifyPassword(h, "otra-clave") || VerifyPassword("basura", "x") {
		t.Fatal("acepta una clave o hash inválidos")
	}
}

func TestVerifyArgon2CffiHash(t *testing.T) {
	// hash generado por argon2-cffi (backend Python anterior): las cuentas migradas siguen entrando
	h := "$argon2id$v=19$m=65536,t=3,p=4$QVI5OeArtU6MvxPxgwyp+A$cS0dZplH7f8KvcpWgA9oHCszeveGtUJsH+voSLrvsc0"
	if !VerifyPassword(h, "clave-del-backend-python") {
		t.Fatal("no verifica un hash de argon2-cffi")
	}
	if VerifyPassword(h, "otra") {
		t.Fatal("acepta otra clave")
	}
}

func TestTokens(t *testing.T) {
	now := time.Now()
	tok, err := SignToken("secreto", Claims{Sub: "u1", Typ: "access"}, time.Minute, now)
	if err != nil {
		t.Fatal(err)
	}
	c, err := ParseToken("secreto", tok, "access", now)
	if err != nil || c.Sub != "u1" {
		t.Fatalf("no valida un token correcto: %v", err)
	}
	if _, err := ParseToken("secreto", tok, "refresh", now); err == nil {
		t.Fatal("acepta un token de otro tipo")
	}
	if _, err := ParseToken("otro", tok, "access", now); err == nil {
		t.Fatal("acepta otra firma")
	}
	if _, err := ParseToken("secreto", tok, "access", now.Add(2*time.Minute)); err == nil {
		t.Fatal("acepta un token vencido")
	}
	parts := strings.Split(tok, ".")
	if _, err := ParseToken("secreto", parts[0]+"."+parts[1]+"x."+parts[2], "access", now); err == nil {
		t.Fatal("acepta un token alterado")
	}
	if _, err := ParseToken("secreto", "eyJhbGciOiJub25lIn0.e30.", "access", now); err == nil {
		t.Fatal("acepta alg none")
	}
}

func TestIDs(t *testing.T) {
	id := NewID()
	if len(id) != 36 || id[14] != '4' {
		t.Fatalf("UUID v4 inválido: %s", id)
	}
	if NewID() == id || len(RandomToken(12)) != 16 {
		t.Fatal("ids repetidos o largo inesperado")
	}
}
