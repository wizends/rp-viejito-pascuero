// Package imaging valida y limpia las fotos de las cartas.
//
// La imagen se decodifica, se endereza según su orientación EXIF, se achica y
// se vuelve a codificar desde los píxeles: así se descartan EXIF, GPS y
// cualquier metadato o carga escondida. No se lee el texto (sin OCR).
package imaging

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png" // registra el decodificador PNG

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // registra el decodificador WebP
)

const (
	// MaxSide es el lado mayor de la imagen guardada.
	MaxSide = 2400
	// MaxPixels evita "bombas de descompresión".
	MaxPixels = 40_000_000
	quality   = 88
)

// Error es un rechazo con mensaje para la familia. Unsupported marca un formato no permitido (415).
type Error struct {
	Msg         string
	Unsupported bool
}

func (e *Error) Error() string { return e.Msg }

func reject(msg string) error { return &Error{Msg: msg} }

// Sniff detecta el tipo por sus primeros bytes, ignorando extensión y Content-Type.
func Sniff(head []byte) string {
	switch {
	case bytes.HasPrefix(head, []byte{0xff, 0xd8, 0xff}):
		return "image/jpeg"
	case bytes.HasPrefix(head, []byte("\x89PNG\r\n\x1a\n")):
		return "image/png"
	case len(head) >= 12 && string(head[0:4]) == "RIFF" && string(head[8:12]) == "WEBP":
		return "image/webp"
	}
	return ""
}

// Cleaned es la imagen limpia, lista para guardar.
type Cleaned struct {
	Data          []byte // JPEG
	Width, Height int
}

// Clean valida, endereza, achica y re-codifica la imagen como JPEG.
func Clean(data []byte, maxBytes int) (*Cleaned, error) {
	if len(data) == 0 {
		return nil, reject("El archivo está vacío.")
	}
	if len(data) > maxBytes {
		return nil, reject(fmt.Sprintf("El archivo supera los %d MB.", maxBytes/(1024*1024)))
	}
	mime := Sniff(data[:min(len(data), 32)])
	if mime == "" {
		return nil, &Error{Msg: "Formato no permitido. Usa JPG, PNG o WebP.", Unsupported: true}
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, reject("No pudimos abrir la imagen. ¿Está dañada?")
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > MaxPixels {
		return nil, reject("La imagen es demasiado grande.")
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, reject("No pudimos abrir la imagen. ¿Está dañada?")
	}
	if mime == "image/jpeg" {
		img = orient(img, jpegOrientation(data))
	}
	img = fit(img, MaxSide)

	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	b := img.Bounds()
	return &Cleaned{Data: out.Bytes(), Width: b.Dx(), Height: b.Dy()}, nil
}

// fit achica a maxSide (sin agrandar) y aplana la transparencia sobre blanco.
func fit(src image.Image, maxSide int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > maxSide || h > maxSide {
		if w >= h {
			h = h * maxSide / w
			w = maxSide
		} else {
			w = w * maxSide / h
			h = maxSide
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, max(w, 1), max(h, 1)))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}

// orient aplica la orientación EXIF (1..8) a los píxeles.
func orient(src image.Image, o int) image.Image {
	if o < 2 || o > 8 {
		return src
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	swap := o >= 5
	dw, dh := w, h
	if swap {
		dw, dh = h, w
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var dx, dy int
			switch o {
			case 2: // espejo horizontal
				dx, dy = w-1-x, y
			case 3: // 180°
				dx, dy = w-1-x, h-1-y
			case 4: // espejo vertical
				dx, dy = x, h-1-y
			case 5: // transpuesta
				dx, dy = y, x
			case 6: // 90° horario
				dx, dy = h-1-y, x
			case 7: // transversa
				dx, dy = h-1-y, w-1-x
			case 8: // 90° antihorario
				dx, dy = y, w-1-x
			}
			dst.Set(dx, dy, src.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

// jpegOrientation lee la etiqueta 0x0112 del segmento EXIF (APP1). 1 si no hay.
func jpegOrientation(data []byte) int {
	i := 2
	for i+4 <= len(data) {
		if data[i] != 0xff {
			return 1
		}
		marker := data[i+1]
		if marker == 0xda || marker == 0xd9 { // inicio de los datos de imagen
			return 1
		}
		size := int(binary.BigEndian.Uint16(data[i+2 : i+4]))
		if size < 2 || i+2+size > len(data) {
			return 1
		}
		seg := data[i+4 : i+2+size]
		if marker == 0xe1 && len(seg) > 14 && string(seg[:6]) == "Exif\x00\x00" {
			if o, err := tiffOrientation(seg[6:]); err == nil {
				return o
			}
			return 1
		}
		i += 2 + size
	}
	return 1
}

func tiffOrientation(t []byte) (int, error) {
	if len(t) < 8 {
		return 0, errors.New("tiff corto")
	}
	var bo binary.ByteOrder
	switch string(t[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return 0, errors.New("orden de bytes")
	}
	off := int(bo.Uint32(t[4:8]))
	if off+2 > len(t) {
		return 0, errors.New("ifd fuera de rango")
	}
	n := int(bo.Uint16(t[off : off+2]))
	for k := 0; k < n; k++ {
		e := off + 2 + k*12
		if e+12 > len(t) {
			break
		}
		if bo.Uint16(t[e:e+2]) == 0x0112 {
			return int(bo.Uint16(t[e+8 : e+10])), nil
		}
	}
	return 1, nil
}
