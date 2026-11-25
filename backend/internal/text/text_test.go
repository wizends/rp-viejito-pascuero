package text

import (
	"strings"
	"testing"
)

func TestMaskPII(t *testing.T) {
	in := "Mi rut es 21.345.678-9, mi teléfono +56 9 8765 4321, vivo en calle Los Aromos 123 " +
		"y voy al Colegio San Pedro. Mail papa@correo.cl"
	out, found := MaskPII(in)
	if !found {
		t.Fatal("no detectó datos sensibles")
	}
	for _, leaked := range []string{"21.345.678-9", "8765", "Aromos 123", "San Pedro", "papa@correo.cl"} {
		if strings.Contains(out, leaked) {
			t.Errorf("se filtró %q en %q", leaked, out)
		}
	}
	if strings.Count(out, Mask) < 4 {
		t.Errorf("esperaba al menos 4 máscaras: %q", out)
	}
	if _, found := MaskPII("Quiero una pelota"); found {
		t.Error("enmascaró un texto inocente")
	}
}

func TestNormalize(t *testing.T) {
	got := Normalize("kerido biejito paskuero, kiero una pelota. gracias")
	if !strings.HasPrefix(got, "Querido viejito pascuero, quiero") || !strings.HasSuffix(got, "Gracias") {
		t.Fatalf("normalización inesperada: %q", got)
	}
}

func TestExtractGifts(t *testing.T) {
	gifts := ExtractGifts("Hola! Quiero una muñeca, un puzzle y una pelota.\n- Lego de autos")
	var names []string
	for _, g := range gifts {
		names = append(names, g.Nombre)
	}
	want := []string{"Lego de autos", "muñeca", "puzzle", "pelota"}
	if strings.Join(names, "|") != strings.Join(want, "|") {
		t.Fatalf("regalos = %v, quería %v", names, want)
	}
	if *gifts[0].Prioridad != 1 || *gifts[3].Prioridad != 4 {
		t.Fatal("prioridades mal asignadas")
	}
}

func TestDetectTone(t *testing.T) {
	cases := map[string]string{
		"te quiero mucho viejito":   "carinoso",
		"ojalá me traigas un perro": "ilusionado",
		"¡hola! ¡estoy feliz!":      "alegre",
		"si puedes, no importa":     "timido",
		"hola":                      "neutral",
	}
	for in, want := range cases {
		if got := DetectTone(in); got != want {
			t.Errorf("DetectTone(%q) = %s, quería %s", in, got, want)
		}
	}
}
