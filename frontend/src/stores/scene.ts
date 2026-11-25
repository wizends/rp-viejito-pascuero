import { create } from 'zustand';
import type { LetterStatus } from '@/lib/types';

/**
 * Máquina de estados de la cinemática de la carta:
 *  idle → flying → caught → reading → (celebrate | help) → idle
 * `flying`/`caught` duran lo que tarda la animación; `reading` espera al backend.
 */
export type ScenePhase = 'idle' | 'flying' | 'caught' | 'reading' | 'celebrate' | 'help';

interface SceneState {
  phase: ScenePhase;
  phaseStart: number;
  letterId: string | null;
  /** estado real del backend; puede llegar antes de que termine el vuelo */
  backendStatus: LetterStatus | null;
  caption: string;
  sceneReady: boolean;
  sendLetter: (letterId: string | null) => void;
  setPhase: (p: ScenePhase) => void;
  setBackendStatus: (letterId: string, s: LetterStatus) => void;
  setSceneReady: (r: boolean) => void;
}

const CAPTIONS: Record<ScenePhase, string> = {
  idle: 'Los duendes esperan nuevas cartas junto a la chimenea.',
  flying: '¡Allá va tu carta volando hacia el Polo Norte!',
  caught: '¡Un duende atrapó tu carta y se la lleva al Viejito!',
  reading: 'El Viejito Pascuero se puso los lentes. Leyendo…',
  celebrate: '¡Qué carta más bonita! ¡Jo, jo, jo! La magia ya va en camino.',
  help: 'Esta carta necesita la ayuda de un duende. ¡Tu papá, mamá o tutor puede ayudar!',
};

export const useScene = create<SceneState>((set, get) => ({
  phase: 'idle',
  phaseStart: 0,
  letterId: null,
  backendStatus: null,
  caption: CAPTIONS.idle,
  sceneReady: false,
  sendLetter: (letterId) =>
    set({
      phase: 'flying',
      phaseStart: performance.now(),
      letterId,
      backendStatus: letterId ? 'recibida' : 'leida',
      caption: CAPTIONS.flying,
    }),
  setPhase: (p) => set({ phase: p, phaseStart: performance.now(), caption: CAPTIONS[p] }),
  // Solo guarda el estado: FlyingLetter decide cuándo pasar de "leyendo" a la
  // reacción final, respetando un tiempo mínimo de lectura (READ_MIN_MS).
  setBackendStatus: (letterId, s) => {
    if (get().letterId !== letterId) return;
    set({ backendStatus: s });
  },
  setSceneReady: (r) => set({ sceneReady: r }),
}));

// caught: atrapa, baja del taburete, rodea el sillón y entrega (cinematic.DELIVERY);
// readMin: lo que tarda el duende en volver a su taburete mientras el Viejito lee
export const PHASE_MS = { flying: 2600, caught: 5100, readMin: 3800, celebrate: 5400, help: 4400 } as const;
