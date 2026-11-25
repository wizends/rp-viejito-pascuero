import { create } from 'zustand';
import { MusicPlayer, SONGS } from '@/lib/music';
import { readJSON, writeJSON } from '@/lib/storage';

const KEY = 'vp:musica';

interface Persisted {
  index: number;
  volume: number;
}

interface MusicState extends Persisted {
  playing: boolean;
  toggle: () => void;
  playSong: (i: number) => void;
  next: () => void;
  setVolume: (v: number) => void;
}

const saved = readJSON<Persisted>(KEY, { index: 0, volume: 0.7 });
const startIndex = Number.isInteger(saved.index) && saved.index >= 0 && saved.index < SONGS.length ? saved.index : 0;
const startVolume = typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : 0.7;

const player = new MusicPlayer({ onSong: (index) => useMusic.setState({ index }) });
player.setVolume(startVolume);

/**
 * Música de fondo. Nunca suena sola: el navegador exige un toque del usuario, y además
 * es una página para niños (sorpresas de sonido no). Se recuerda la canción y el volumen.
 */
export const useMusic = create<MusicState>((set, get) => ({
  index: startIndex,
  volume: startVolume,
  playing: false,
  toggle: () => {
    if (get().playing) {
      player.pause();
      set({ playing: false });
    } else {
      set({ playing: player.play(get().index) });
    }
  },
  playSong: (i) => set({ index: i, playing: player.play(i) }),
  next: () => {
    const i = (get().index + 1) % SONGS.length;
    set({ index: i, playing: player.play(i) });
  },
  setVolume: (v) => {
    player.setVolume(v);
    set({ volume: v });
  },
}));

useMusic.subscribe((s) => writeJSON(KEY, { index: s.index, volume: s.volume }));

// en segundo plano el navegador frena los temporizadores: se pausa y se retoma al volver
if (typeof document !== 'undefined') {
  let resume = false;
  document.addEventListener('visibilitychange', () => {
    const { playing, index } = useMusic.getState();
    if (document.hidden && playing) {
      resume = true;
      player.pause();
    } else if (!document.hidden && resume) {
      resume = false;
      if (useMusic.getState().playing) player.play(index);
    }
  });
}
