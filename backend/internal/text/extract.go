package text

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

// Gift es un regalo extraído del texto (prioridad 1 = el primero pedido).
type Gift struct {
	Nombre    string `json:"nombre"`
	Prioridad *int   `json:"prioridad"`
}

var (
	reRequest  = regexp.MustCompile(`(?i)(?:quiero|quisiera|me gustar[ií]a|te pido|pido|deseo|me traes?|tr[aá]eme|me puedes traer|para navidad quiero)\s+(?:que me traigas\s+)?(?P<items>[^.!?\n]+)`)
	reList     = regexp.MustCompile(`(?m)^\s*(?:[-*•·]|\d+[.)])\s*(?P<item>.+)$`)
	reSplit    = regexp.MustCompile(`,|\s+y\s+|\s+e\s+|\s+o\s+|;`)
	reArticle  = regexp.MustCompile(`(?i)^(?:un|una|unos|unas|el|la|los|las|mi|mis)\s+`)
	rePlease   = regexp.MustCompile(`(?i)\s+(por favor|porfa|gracias).*$`)
	reSpaces   = regexp.MustCompile(`\s+`)
	reHSpace   = regexp.MustCompile(`[ \t]+`)
	reBlank    = regexp.MustCompile(`\n{3,}`)
	reSentence = regexp.MustCompile(`(^|[.!?]\s+)([a-záéíóúñ])`)
)

// Correcciones frecuentes de ortografía infantil.
var fixes = []struct {
	re   *regexp.Regexp
	repl string
}{
	{regexp.MustCompile(`(?i)\bkiero\b`), "quiero"},
	{regexp.MustCompile(`(?i)\bkerido\b`), "querido"},
	{regexp.MustCompile(`(?i)\bbiejito\b`), "viejito"},
	{regexp.MustCompile(`(?i)\bpaskuero\b`), "pascuero"},
	{regexp.MustCompile(`(?i)\bregalo s\b`), "regalos"},
	{regexp.MustCompile(`(?i)\bporfa\b`), "por favor"},
	{regexp.MustCompile(`(?i)\bxfa\b`), "por favor"},
	{regexp.MustCompile(`(?i)\bnavida\b`), "navidad"},
	{regexp.MustCompile(`(?i)\bboy\b`), "voy"},
	{regexp.MustCompile(`(?i)\bq\b`), "que"},
}

// Normalize corrige ortografía frecuente, espacios y mayúsculas de oración.
func Normalize(s string) string {
	out := s
	for _, f := range fixes {
		out = f.re.ReplaceAllString(out, f.repl)
	}
	out = reHSpace.ReplaceAllString(out, " ")
	out = strings.TrimSpace(reBlank.ReplaceAllString(out, "\n\n"))
	return reSentence.ReplaceAllStringFunc(out, func(m string) string {
		r, size := utf8.DecodeLastRuneInString(m)
		return m[:len(m)-size] + strings.ToUpper(string(r))
	})
}

// TidyGift limpia espacios y puntuación del nombre de un regalo (máx. 120 caracteres).
func TidyGift(s string) string {
	s = strings.Trim(strings.TrimSpace(reSpaces.ReplaceAllString(s, " ")), " .,;:-")
	return Truncate(strings.TrimSpace(s), 120)
}

// Truncate corta a n caracteres (no bytes).
func Truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

// ExtractGifts detecta listas y frases de pedido ("quiero una pelota y un auto").
func ExtractGifts(s string) []Gift {
	var found []string
	for _, m := range reList.FindAllStringSubmatch(s, -1) {
		found = append(found, m[1])
	}
	for _, m := range reRequest.FindAllStringSubmatch(s, -1) {
		found = append(found, reSplit.Split(m[1], -1)...)
	}
	var gifts []Gift
	seen := map[string]bool{}
	for _, raw := range found {
		name := reArticle.ReplaceAllString(strings.Trim(strings.TrimSpace(raw), " .,;:-¡!"), "")
		name = strings.TrimSpace(rePlease.ReplaceAllString(name, ""))
		n := utf8.RuneCountInString(name)
		if n < 2 || n > 60 || len(strings.Fields(name)) > 7 {
			continue
		}
		key := strings.ToLower(name)
		if seen[key] {
			continue
		}
		seen[key] = true
		g := Gift{Nombre: TidyGift(name)}
		if len(gifts) < 10 {
			p := len(gifts) + 1
			g.Prioridad = &p
		}
		gifts = append(gifts, g)
		if len(gifts) == 30 {
			break
		}
	}
	return gifts
}

// DetectTone clasifica el tono: alegre, carinoso, ilusionado, timido o neutral.
func DetectTone(s string) string {
	t := strings.ToLower(s)
	has := func(words ...string) bool {
		for _, w := range words {
			if strings.Contains(t, w) {
				return true
			}
		}
		return false
	}
	switch {
	case has("te quiero", "te amo", "abrazo", "besos", "cariño"):
		return "carinoso"
	case has("ojalá", "ojala", "sueño", "por favor", "porfa"):
		return "ilusionado"
	case strings.Count(t, "!") >= 2 || has("jaja", "feliz", "yupi", "genial"):
		return "alegre"
	case has("si se puede", "si puedes", "no importa"):
		return "timido"
	}
	return "neutral"
}
