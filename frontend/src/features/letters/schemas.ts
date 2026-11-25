import { z } from 'zod';

export const MAX_UPLOAD_MB = 10;
export const ACCEPTED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];
export const ACCEPTED_EXT = /\.(jpe?g|png|heic|heif|pdf)$/i;

/** Detección amable de datos que no deberían ir en una carta. */
const SENSITIVE = [
  /\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK]\b/, // RUT
  /(?:\+?56\s*)?\b9[\s.-]*\d{4}[\s.-]*\d{4}\b/, // celular
  /\b(?:calle|avenida|pasaje|villa|población|depto)\s+\S+.*\d{1,5}/i,
  /\b(?:colegio|escuela|liceo)\s+[A-ZÁÉÍÓÚÑ]/,
];

export function looksSensitive(text: string): boolean {
  return SENSITIVE.some((r) => r.test(text));
}

export const writeLetterSchema = z
  .object({
    deseos: z.array(z.object({ value: z.string().trim().max(120, 'Máximo 120 letras por deseo') })).max(20),
    mensaje: z.string().max(4000, 'La carta es muy larga (máximo 4000 letras)'),
  })
  .refine((v) => v.mensaje.trim().length > 0 || v.deseos.some((d) => d.value.trim()), {
    message: 'Escribe al menos un deseo o un mensajito para el Viejito.',
    path: ['mensaje'],
  });

export type WriteLetterValues = z.infer<typeof writeLetterSchema>;

export function validateFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `La foto pesa más de ${MAX_UPLOAD_MB} MB.`;
  if (!ACCEPTED.includes(file.type) && !ACCEPTED_EXT.test(file.name)) {
    return 'Ese formato no lo leen los duendes. Usa JPG, PNG, HEIC o PDF.';
  }
  return null;
}
