package security

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Claims del token. Typ distingue "access" de "refresh"; Jti identifica el refresh guardado.
type Claims struct {
	Sub string `json:"sub"`
	Typ string `json:"typ"`
	Jti string `json:"jti,omitempty"`
	Iat int64  `json:"iat"`
	Exp int64  `json:"exp"`
}

var (
	jwtHeader = base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	// ErrToken cubre firma, formato, tipo y expiración inválidos.
	ErrToken = errors.New("token inválido")
)

// SignToken firma un JWT HS256.
func SignToken(secret string, c Claims, ttl time.Duration, now time.Time) (string, error) {
	c.Iat = now.Unix()
	c.Exp = now.Add(ttl).Unix()
	body, err := json.Marshal(c)
	if err != nil {
		return "", err
	}
	unsigned := jwtHeader + "." + base64.RawURLEncoding.EncodeToString(body)
	return unsigned + "." + sign(secret, unsigned), nil
}

// ParseToken valida firma, algoritmo, tipo y expiración.
func ParseToken(secret, token, wantType string, now time.Time) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrToken
	}
	head, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, ErrToken
	}
	var h struct {
		Alg string `json:"alg"`
	}
	if json.Unmarshal(head, &h) != nil || h.Alg != "HS256" {
		return nil, ErrToken
	}
	if !hmac.Equal([]byte(sign(secret, parts[0]+"."+parts[1])), []byte(parts[2])) {
		return nil, ErrToken
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrToken
	}
	var c Claims
	if json.Unmarshal(raw, &c) != nil || c.Typ != wantType || c.Sub == "" || now.Unix() >= c.Exp {
		return nil, ErrToken
	}
	return &c, nil
}

func sign(secret, data string) string {
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// RandomToken devuelve n bytes aleatorios en base64url (como secrets.token_urlsafe).
func RandomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// NewID devuelve un UUID v4.
func NewID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	const hex = "0123456789abcdef"
	out := make([]byte, 0, 36)
	for i, c := range b {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			out = append(out, '-')
		}
		out = append(out, hex[c>>4], hex[c&0x0f])
	}
	return string(out)
}
