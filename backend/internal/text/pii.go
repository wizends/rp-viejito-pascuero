// Package text enmascara datos sensibles y extrae regalos y tono del texto de una carta.
package text

import "regexp"

// Mask reemplaza RUT, teléfonos, correos, direcciones y colegios.
const Mask = "[🔒 dato protegido]"

const letters = `\wáéíóúñÁÉÍÓÚÑ`

var (
	reEmail  = regexp.MustCompile(`\b[\w.+-]+@[\w-]+\.[\w.-]+\b`)
	reRUT    = regexp.MustCompile(`\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK]\b`)
	rePhone  = regexp.MustCompile(`(?:\+?56\s*)?(?:\(?\d\)?[\s.-]*)?\b9[\s.-]*\d{4}[\s.-]*\d{4}\b|\b\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b`)
	street   = `calle|avenida|av\.?|pasaje|psje\.?|camino|villa|población|poblacion|block|depto\.?|departamento|casa|condominio`
	reAddr   = regexp.MustCompile(`(?i)\b(?:vivo en |mi casa (?:es|está|esta) en )?(?:` + street + `)\s+[` + letters + ` ]{2,40}?\s*(?:n[°º]?|#|número|numero)?\s*\d{1,5}\b`)
	reSchool = regexp.MustCompile(`\b(?i:colegio|escuela|liceo|jardín|jardin)\s+[A-ZÁÉÍÓÚÑ][` + letters + `]+(?:\s+[A-ZÁÉÍÓÚÑ][` + letters + `]+){0,3}`)
)

// MaskPII devuelve el texto enmascarado y si encontró algo.
func MaskPII(s string) (string, bool) {
	out := s
	for _, re := range []*regexp.Regexp{reEmail, reRUT, rePhone, reAddr, reSchool} {
		out = re.ReplaceAllLiteralString(out, Mask)
	}
	return out, out != s
}
