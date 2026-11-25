package api

import (
	"bytes"
	"image/jpeg"
	"testing"
)

func TestTreePhotoAndSantaSelfie(t *testing.T) {
	e := newEnv(t)
	c := e.parent("arbol@ejemplo.cl")
	kid := c.child("Sofi")
	sh := c.get("/api/children/" + kid + "/shipment").json(t)
	id, code := sh["id"].(string), sh["share_code"].(string)
	if sh["has_tree_photo"] != false {
		t.Fatalf("trayecto nuevo con foto: %v", sh)
	}
	sh = c.post("/api/shipments/"+id+"/stops/templates", nil).json(t)

	// otro padre no puede tocar el árbol ajeno
	intruso := e.parent("otro@ejemplo.cl")
	if r := intruso.put("/api/shipments/"+id+"/tree", upload(nil, testJPEG(t))); r.status != 404 {
		t.Fatalf("árbol ajeno: %d", r.status)
	}
	if r := c.put("/api/shipments/"+id+"/tree", upload(nil, []byte("no soy imagen"))); r.status != 415 {
		t.Fatalf("archivo inválido: %d", r.status)
	}

	r := c.put("/api/shipments/"+id+"/tree", upload(nil, testJPEG(t)))
	if r.status != 200 || r.json(t)["has_tree_photo"] != true {
		t.Fatalf("subir árbol: %d %s", r.status, r.body)
	}
	img := c.get("/api/shipments/" + id + "/tree")
	if img.status != 200 || img.header.Get("Content-Type") != "image/jpeg" || bytes.Contains(img.body, []byte("Exif")) {
		t.Fatalf("foto del árbol: %d %v", img.status, img.header)
	}
	if _, err := jpeg.Decode(bytes.NewReader(img.body)); err != nil {
		t.Fatal("la foto del árbol no es JPEG")
	}

	// antes de la entrega el niño no ve la foto (ni sabe que existe)
	pub := e.client()
	if v := pub.get("/api/tracking/" + code).json(t); v["selfie"] != false {
		t.Fatalf("selfie antes de tiempo: %v", v["selfie"])
	}
	if r := pub.get("/api/tracking/" + code + "/selfie"); r.status != 404 {
		t.Fatalf("selfie antes de la entrega: %d", r.status)
	}

	// el Viejito deja el regalo: se completa "¡Bajo el árbol!"
	stops := sh["stops"].([]any)
	arbol := stops[len(stops)-1].(map[string]any)
	if arbol["icono"] != "arbol" {
		t.Fatalf("última parada: %v", arbol)
	}
	c.patch("/api/stops/"+arbol["id"].(string), map[string]any{"completed": true})
	if v := pub.get("/api/tracking/" + code).json(t); v["selfie"] != true {
		t.Fatalf("selfie tras la entrega: %v", v["selfie"])
	}
	self := pub.get("/api/tracking/" + code + "/selfie")
	if self.status != 200 || self.header.Get("Cache-Control") != "private, no-store" || !bytes.Equal(self.body, img.body) {
		t.Fatalf("selfie pública: %d", self.status)
	}

	// borrar la foto la quita también de la vista del niño
	if r := c.delete("/api/shipments/" + id + "/tree"); r.status != 200 || r.json(t)["has_tree_photo"] != false {
		t.Fatalf("borrar árbol: %d", r.status)
	}
	if r := pub.get("/api/tracking/" + code + "/selfie"); r.status != 404 {
		t.Fatalf("selfie tras borrar: %d", r.status)
	}
}
