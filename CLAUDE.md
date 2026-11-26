# Buzón del Viejito Pascuero — cómo se trabaja aquí

Guía del repo (mapas, recetas, trampas y verificación): `.claude/skills/buzon-dev/SKILL.md`.

## Flujo obligatorio para cualquier cambio en el repo

Cada pedido que cambie archivos del repo (feature, bug, estilo, configuración) se resuelve con tres roles:

| Rol | Modelo | Quién | Hace |
|---|---|---|---|
| **Arquitecto / planificador** | Opus 5.5 | la sesión principal | entiende el pedido, planifica, coordina, desbloquea y revisa |
| **Lector** | Sonnet | agente `Explore` (`.claude/agents/explore.md`, reemplaza al Explore integrado) | lee todos los archivos necesarios y entrega el informe |
| **Codificador** | Haiku | agente `codificador` | escribe todo el código siguiendo el plan |

La sesión principal debe correr en Opus (`.claude/settings.json` lo fija con `"model": "opus"`). Si no está en Opus, avísale al usuario antes de empezar.

### Pasos

1. **Leer con Sonnet.** El arquitecto lanza el agente `Explore` con el pedido, lo que necesita saber y el nivel de detalle (`quick`, `medium` o `very thorough`). No abre los archivos él mismo para planificar; usa el informe. Si la tarea abarca zonas independientes (por ejemplo backend y frontend), lanza un `Explore` por zona en paralelo.
2. **Planificar con Opus.** Con el informe, el arquitecto escribe un plan para el codificador. Debe ser tan concreto que no haya nada que decidir:
   - archivos a tocar, en orden;
   - por cada uno: qué cambia, con nombres, firmas, tipos y textos exactos (y el fragmento de código cuando el cambio no es obvio);
   - el patrón o archivo "hermano" que debe imitar;
   - las verificaciones que debe correr al final.
   Si el pedido del usuario es ambiguo, pregúntale al usuario antes de planificar.
3. **Codificar con Haiku.** El arquitecto lanza el agente `codificador` con el plan completo. Si el cambio es grande, lo divide en partes que no se pisen (archivos distintos) y lanza un codificador por parte. Partes que dependen unas de otras van en orden.
4. **Revisar con Opus.** El arquitecto revisa el diff (`git diff`) y las verificaciones del codificador. Si algo está mal, le manda las correcciones al mismo codificador. Para cambios visibles en el navegador, verifica en el navegador.

### Cuando el lector o el codificador se traban

- Si un agente termina con `NECESITO_ACLARACION:` (Explore) o `BLOQUEADO:` (codificador), el arquitecto **intercepta**: lee la duda, la resuelve (leyendo lo puntual, decidiendo o, si es una decisión del usuario, preguntándole) y **continúa la misma conversación del agente con SendMessage**, para que siga desde donde quedó con su contexto. No lanza uno nuevo.
- Si el mismo agente se traba dos veces en el mismo punto, el arquitecto puede escribir él mismo ese fragmento puntual y devolverle el resto al codificador.
- El arquitecto también puede intervenir sin que se lo pidan si ve que el agente va por mal camino.

### Configuración

- Agentes en `.claude/agents/`: `explore.md` (name `Explore`, Sonnet, solo lectura) y `codificador.md` (Haiku). Ambos precargan la skill `buzon-dev` con `skills:` y no pueden lanzar otros agentes (`disallowedTools: Agent`); solo el arquitecto coordina.
- Para invocarlos a mano: `@agent-Explore` o `@agent-codificador`.

### Excepciones

- Preguntas, explicaciones o revisiones que no cambian archivos: no hace falta el flujo.
- Commit y push solo cuando el usuario lo pide.
