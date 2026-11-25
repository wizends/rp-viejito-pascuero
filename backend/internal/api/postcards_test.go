package api

import "testing"

func design() map[string]any {
	return map[string]any{
		"style": "anime", "format": "cuadrado", "theme": "rosa", "frame": "corazones", "snow": true,
		"title": "¡Mi carta!", "signature": "Con cariño, Sofi", "show": "foto",
		"letter":   map[string]any{"x": 0.5, "y": 0.53, "scale": 1, "rot": -0.04},
		"stickers": []any{map[string]any{"id": "s1", "sticker": "reno_rosa", "x": 0.2, "y": 0.3, "size": 0.15, "rot": 0.1}},
	}
}

func TestPostcardIsSavedPerLetter(t *testing.T) {
	e := newEnv(t)
	c := e.parent("postal@ejemplo.cl")
	kid := c.child("Sofi")
	l := c.post("/api/letters", map[string]any{"child_id": kid, "deseos": []string{"un trineo"}}).json(t)
	id := l["id"].(string)

	if r := c.get("/api/letters/" + id + "/postcard"); r.status != 404 {
		t.Fatalf("postal sin guardar: %d", r.status)
	}
	r := c.put("/api/letters/"+id+"/postcard", map[string]any{"design": design()})
	if r.status != 200 || r.json(t)["updated_at"] == nil {
		t.Fatalf("guardar: %d %s", r.status, r.body)
	}

	// otro equipo (otra sesión del mismo padre) ve el mismo diseño
	otro := e.client()
	otro.login("postal@ejemplo.cl")
	got := otro.get("/api/letters/" + id + "/postcard")
	if got.status != 200 || got.header.Get("Cache-Control") != "private, no-store" {
		t.Fatalf("leer: %d", got.status)
	}
	d := got.json(t)["design"].(map[string]any)
	if d["style"] != "anime" || d["title"] != "¡Mi carta!" || len(d["stickers"].([]any)) != 1 {
		t.Fatalf("diseño leído: %v", d)
	}

	// se reemplaza y los campos desconocidos no se guardan
	nd := design()
	nd["stickers"] = []any{}
	nd["extra"] = "<script>"
	c.put("/api/letters/"+id+"/postcard", map[string]any{"design": nd})
	d = c.get("/api/letters/" + id + "/postcard").json(t)["design"].(map[string]any)
	if len(d["stickers"].([]any)) != 0 || d["extra"] != nil {
		t.Fatalf("reemplazo: %v", d)
	}

	// nadie más puede verla ni cambiarla
	intruso := e.parent("intruso@ejemplo.cl")
	if r := intruso.get("/api/letters/" + id + "/postcard"); r.status != 404 {
		t.Fatalf("postal ajena: %d", r.status)
	}
	if r := intruso.put("/api/letters/"+id+"/postcard", map[string]any{"design": design()}); r.status != 404 {
		t.Fatalf("guardar ajena: %d", r.status)
	}

	// al borrar la carta se borra su postal
	c.delete("/api/letters/" + id)
	var n int
	if err := e.srv.store.DB.QueryRow(`SELECT COUNT(*) FROM letter_postcards`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("postal huérfana: %d %v", n, err)
	}
}

func TestPostcardRejectsBadDesigns(t *testing.T) {
	e := newEnv(t)
	c := e.parent("mala@ejemplo.cl")
	kid := c.child("Leo")
	id := c.post("/api/letters", map[string]any{"child_id": kid, "deseos": []string{"pelota"}}).json(t)["id"].(string)

	many := make([]any, 41)
	for i := range many {
		many[i] = map[string]any{"id": "s", "sticker": "copo", "x": 0.5, "y": 0.5, "size": 0.1, "rot": 0}
	}
	cases := map[string]func(d map[string]any){
		"estilo raro":      func(d map[string]any) { d["style"] = "../../x" },
		"título largo":     func(d map[string]any) { d["title"] = string(make([]rune, 61)) },
		"fuera del lienzo": func(d map[string]any) { d["letter"] = map[string]any{"x": 3, "y": 0.5, "scale": 1, "rot": 0} },
		"muchos stickers":  func(d map[string]any) { d["stickers"] = many },
		"sticker raro": func(d map[string]any) {
			d["stickers"] = []any{map[string]any{"id": "a", "sticker": "<img>", "x": 0.5, "y": 0.5, "size": 0.1}}
		},
		"mostrar raro": func(d map[string]any) { d["show"] = "video" },
	}
	for name, mod := range cases {
		d := design()
		mod(d)
		if r := c.put("/api/letters/"+id+"/postcard", map[string]any{"design": d}); r.status != 422 {
			t.Errorf("%s: %d %s", name, r.status, r.body)
		}
	}
	if r := c.put("/api/letters/"+id+"/postcard", map[string]any{}); r.status != 422 {
		t.Errorf("sin diseño: %d", r.status)
	}
}
