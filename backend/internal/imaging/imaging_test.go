package imaging

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"testing"
)

func TestSniff(t *testing.T) {
	cases := map[string]string{
		"\x89PNG\r\n\x1a\n....":       "image/png",
		"\xff\xd8\xff\xe0":            "image/jpeg",
		"RIFF\x00\x00\x00\x00WEBPVP8": "image/webp",
		"<script>alert(1)</script>":   "",
		"%PDF-1.7":                    "",
	}
	for in, want := range cases {
		if got := Sniff([]byte(in)); got != want {
			t.Errorf("Sniff(%q) = %q, quería %q", in, got, want)
		}
	}
}

func TestCleanStripsEXIFAndGPS(t *testing.T) {
	src, err := os.ReadFile("testdata/carta_con_gps.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(src, []byte("Exif\x00\x00")) {
		t.Fatal("la imagen de prueba debería traer EXIF")
	}
	out, err := Clean(src, 10<<20)
	if err != nil {
		t.Fatal(err)
	}
	clean := out.Data
	if bytes.Contains(clean, []byte("Exif")) || bytes.Contains(clean, []byte("GPS")) {
		t.Fatal("la imagen guardada conserva metadatos")
	}
	if _, err := jpeg.Decode(bytes.NewReader(clean)); err != nil {
		t.Fatal("no es un JPEG válido")
	}
}

func TestCleanResizesAndFlattens(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 3000, 1500)) // transparente
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	out, err := Clean(buf.Bytes(), 10<<20)
	if err != nil {
		t.Fatal(err)
	}
	if out.Width != MaxSide || out.Height != 1200 {
		t.Fatalf("tamaño %dx%d", out.Width, out.Height)
	}
	dec, _ := jpeg.Decode(bytes.NewReader(out.Data))
	r, g, b, _ := dec.At(10, 10).RGBA()
	if r>>8 < 250 || g>>8 < 250 || b>>8 < 250 {
		t.Fatal("la transparencia debería quedar blanca")
	}
}

func TestCleanRejects(t *testing.T) {
	if _, err := Clean(nil, 10<<20); err == nil {
		t.Error("acepta un archivo vacío")
	}
	var ie *Error
	if _, err := Clean([]byte("MZ\x90\x00 esto es un exe"), 10<<20); !errors.As(err, &ie) || !ie.Unsupported {
		t.Error("debería rechazar un formato no permitido como no soportado")
	}
	if _, err := Clean(append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 11<<20)...), 10<<20); err == nil {
		t.Error("acepta un archivo demasiado grande")
	}
	if _, err := Clean([]byte("\x89PNG\r\n\x1a\nroto"), 10<<20); err == nil {
		t.Error("acepta un PNG dañado")
	}
}

func TestOrientation(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2, 1))
	src.Set(0, 0, color.RGBA{255, 0, 0, 255}) // rojo a la izquierda
	rot := orient(src, 6)                     // 90° horario
	if b := rot.Bounds(); b.Dx() != 1 || b.Dy() != 2 {
		t.Fatalf("tamaño tras rotar: %v", b)
	}
	if r, _, _, _ := rot.At(0, 0).RGBA(); r>>8 != 255 {
		t.Fatal("el píxel rojo debería quedar arriba")
	}
}
