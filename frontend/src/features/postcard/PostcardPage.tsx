import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  BringToFront,
  Download,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Share2,
  ShieldAlert,
  Trash2,
  Undo2,
  Copy,
  RefreshCcw,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { readJSON, writeJSON } from '@/lib/storage';
import { MagicButton } from '@/components/ui/MagicButton';
import { toast } from '@/components/ui/Toast';
import {
  FORMATS,
  FRAMES,
  MAX_STICKERS,
  THEMES,
  clamp,
  defaultPostcard,
  hitTest,
  letterText,
  loadFonts,
  loadStickers,
  renderPostcard,
  type Box,
  type Format,
  type Frame,
  type LetterContent,
  type Postcard,
  type Selection,
  type Theme,
} from './render';
import { STICKERS, STICKER_GROUPS, STICKER_IDS, stickerSvg, type StickerId } from './stickers';
import { FONTS, STYLES, STYLE_IDS, type Style } from './styles';
import './fonts.css';

const svgUrl = (id: StickerId) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stickerSvg(id))}`;

/** Editor de la postal navideña: la carta del niño decorada para compartir en redes. */
export default function PostcardPage() {
  const { letterId = '' } = useParams();
  const letter = useQuery({ queryKey: ['letter', letterId], queryFn: () => api.letter(letterId) });
  const children = useQuery({ queryKey: ['children'], queryFn: api.children });
  const nickname = children.data?.find((c) => c.id === letter.data?.child_id)?.nickname ?? '';
  const photo = useQuery({
    queryKey: ['letter-image', letterId],
    queryFn: async () => createImageBitmap(await api.letterImage(letterId)),
    enabled: !!letter.data?.has_image,
    staleTime: Infinity,
    retry: false,
  });
  const text = letter.data ? letterText(letter.data) : '';
  const [show, setShow] = useState<'foto' | 'texto'>('foto');
  const content = useMemo<LetterContent | null>(() => {
    if (photo.data && (show === 'foto' || !text)) return { kind: 'foto', image: photo.data };
    return text ? { kind: 'texto', text } : null;
  }, [photo.data, show, text]);

  const key = `postal:${letterId}`;
  const [p, setP] = useState<Postcard | null>(null);
  useEffect(() => {
    if (letter.data && children.data && !p) {
      // las postales guardadas antes de un cambio reciben lo que les falte (p. ej. el estilo)
      const saved = readJSON<Partial<Postcard> | null>(key, null);
      setP({ ...defaultPostcard(nickname), ...saved });
    }
  }, [letter.data, children.data, p, key, nickname]);
  useEffect(() => {
    if (p) writeJSON(key, p);
  }, [p, key]);

  const [stickers, setStickers] = useState<Record<StickerId, HTMLImageElement> | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    void loadStickers(STICKER_IDS).then(setStickers, () => toast('No se pudieron cargar los stickers.', 'error'));
    void loadFonts().then(() => setFontsReady(true));
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const letterBox = useRef<Box | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const drag = useRef<{ dx: number; dy: number; pointer: number } | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !p || !stickers || !content) return;
    const f = FORMATS[p.format];
    if (cv.width !== f.w || cv.height !== f.h) {
      cv.width = f.w;
      cv.height = f.h;
    }
    letterBox.current = renderPostcard(cv.getContext('2d')!, p, { stickers, letter: content }, sel);
  }, [p, sel, stickers, content, fontsReady]);

  const update = (fn: (q: Postcard) => Postcard) => setP((q) => (q ? fn(q) : q));
  const setField = <K extends keyof Postcard>(k: K, v: Postcard[K]) => update((q) => ({ ...q, [k]: v }));

  /** Cambia el elemento seleccionado (carta o sticker). */
  const edit = (fn: (it: { x: number; y: number; rot: number; size: number }) => Partial<{ x: number; y: number; rot: number; size: number }>) =>
    update((q) => {
      if (sel?.type === 'carta') {
        const ch = fn({ ...q.letter, size: q.letter.scale });
        return {
          ...q,
          letter: {
            x: ch.x ?? q.letter.x,
            y: ch.y ?? q.letter.y,
            rot: ch.rot ?? q.letter.rot,
            scale: clamp(ch.size ?? q.letter.scale, 0.45, 1.35),
          },
        };
      }
      if (sel?.type === 'sticker') {
        return {
          ...q,
          stickers: q.stickers.map((s) => {
            if (s.id !== sel.id) return s;
            const ch = fn(s);
            return { ...s, ...ch, size: clamp(ch.size ?? s.size, 0.05, 0.5) };
          }),
        };
      }
      return q;
    });

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget;
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!p) return;
    const { x, y } = point(e);
    const hit = hitTest(p, letterBox.current, x, y);
    setSel(hit);
    if (!hit) return;
    const f = FORMATS[p.format];
    const it = hit.type === 'carta' ? p.letter : p.stickers.find((s) => s.id === hit.id)!;
    drag.current = { dx: x - it.x * f.w, dy: y - it.y * f.h, pointer: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    // el sticker tocado pasa al frente
    if (hit.type === 'sticker') update((q) => ({ ...q, stickers: [...q.stickers.filter((s) => s.id !== hit.id), it as Postcard['stickers'][number]] }));
  };
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!p || !drag.current || drag.current.pointer !== e.pointerId) return;
    const { x, y } = point(e);
    const f = FORMATS[p.format];
    // se copia ahora: React aplica el cambio después y para entonces el arrastre pudo terminar
    const { dx, dy } = drag.current;
    edit(() => ({ x: clamp((x - dx) / f.w, 0, 1), y: clamp((y - dy) / f.h, 0, 1) }));
  };
  const onUp = () => (drag.current = null);

  const removeSel = () => {
    if (sel?.type !== 'sticker') return;
    update((q) => ({ ...q, stickers: q.stickers.filter((s) => s.id !== sel.id) }));
    setSel(null);
  };
  const toFront = () => {
    if (sel?.type !== 'sticker') return;
    update((q) => {
      const it = q.stickers.find((s) => s.id === sel.id)!;
      return { ...q, stickers: [...q.stickers.filter((s) => s.id !== sel.id), it] };
    });
  };

  const order = useMemo<Selection[]>(() => (p ? [{ type: 'carta' }, ...p.stickers.map((s) => ({ type: 'sticker' as const, id: s.id }))] : []), [p]);
  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!p) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === 'Enter' || e.key === ' ') {
      const i = order.findIndex((o) => o?.type === sel?.type && (o?.type !== 'sticker' || (sel?.type === 'sticker' && o.id === sel.id)));
      setSel(order[(i + 1) % order.length] ?? null);
    } else if (moves[e.key] && sel) {
      const [dx, dy] = moves[e.key]!;
      edit((it) => ({ x: clamp(it.x + dx, 0, 1), y: clamp(it.y + dy, 0, 1) }));
    } else if ((e.key === '+' || e.key === '=') && sel) {
      edit((it) => ({ size: it.size * 1.1 }));
    } else if (e.key === '-' && sel) {
      edit((it) => ({ size: it.size / 1.1 }));
    } else if (e.key.toLowerCase() === 'r' && sel) {
      edit((it) => ({ rot: it.rot + (e.shiftKey ? -0.15 : 0.15) }));
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.type === 'sticker') {
      removeSel();
    } else if (e.key === 'Escape') {
      setSel(null);
    } else return;
    e.preventDefault();
  };

  /** Agrega un sticker; `at` es el punto donde se soltó (fracción del lienzo). */
  const addSticker = (id: StickerId, at?: { x: number; y: number }) => {
    if (!p) return;
    if (p.stickers.length >= MAX_STICKERS) return toast(`Máximo ${MAX_STICKERS} stickers por postal.`, 'error');
    const n = p.stickers.length;
    const st = {
      id: `s${Date.now()}`,
      sticker: id,
      x: at?.x ?? 0.3 + ((n * 0.17) % 0.4),
      y: at?.y ?? 0.3 + ((n * 0.23) % 0.4),
      size: 0.15,
      rot: ((n % 5) - 2) * 0.12,
    };
    update((q) => ({ ...q, stickers: [...q.stickers, st] }));
    setSel({ type: 'sticker', id: st.id });
  };

  // ---------- arrastrar stickers desde la paleta (mouse y dedo) ----------
  const paletteDrag = useRef<{ id: StickerId; sx: number; sy: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ id: StickerId; x: number; y: number; over: boolean } | null>(null);

  /** Punto de la pantalla → fracción del lienzo, o null si cae afuera. */
  const onCanvas = (cx: number, cy: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height };
  };
  const paletteDown = (id: StickerId) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    paletteDrag.current = { id, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const paletteMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = paletteDrag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    setGhost({ id: d.id, x: e.clientX, y: e.clientY, over: !!onCanvas(e.clientX, e.clientY) });
  };
  const paletteUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = paletteDrag.current;
    paletteDrag.current = null;
    setGhost(null);
    if (!d) return;
    if (!d.moved) return addSticker(d.id); // un toque: lo pone en el lienzo
    const at = onCanvas(e.clientX, e.clientY);
    if (at) addSticker(d.id, at);
  };
  const paletteCancel = () => {
    paletteDrag.current = null;
    setGhost(null);
  };

  // ---------- imagen final, compartir y empezar de nuevo ----------
  const renderPng = (q: Postcard): Promise<Blob> => {
    const f = FORMATS[q.format];
    const cv = document.createElement('canvas');
    cv.width = f.w;
    cv.height = f.h;
    renderPostcard(cv.getContext('2d')!, q, { stickers: stickers!, letter: content! });
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo crear la imagen.'))), 'image/png'));
  };
  // la imagen se prepara apenas se deja de editar: así "Compartir" abre al instante
  // (los navegadores exigen llamar a share() justo después del toque)
  const [png, setPng] = useState<{ blob: Blob; of: Postcard } | null>(null);
  useEffect(() => {
    if (!p || !stickers || !content) return;
    let alive = true;
    const t = window.setTimeout(() => {
      void renderPng(p).then((blob) => alive && setPng({ blob, of: p }), () => undefined);
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, stickers, content, fontsReady]);
  const currentPng = async () => (png && png.of === p ? png.blob : renderPng(p!));

  const fileOf = (b: Blob) => new File([b], 'postal-navidena.png', { type: 'image/png' });
  const nativeShare = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare?.({ files: [fileOf(new Blob(['x'], { type: 'image/png' }))] }),
    [],
  );
  const [shareMenu, setShareMenu] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shareMenu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !actionsRef.current?.contains(e.target as Node)) setShareMenu(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [shareMenu]);
  const download = async () => {
    const url = URL.createObjectURL(await currentPng());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'postal-navidena.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setShareMenu(false);
  };
  const copyImage = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentPng() })]);
      toast('Imagen copiada. Pégala en Instagram, WhatsApp o Facebook.');
    } catch {
      toast('Este navegador no deja copiar imágenes. Usa "Descargar".', 'error');
    }
    setShareMenu(false);
  };
  const share = async () => {
    if (!nativeShare) return setShareMenu((v) => !v);
    try {
      await navigator.share({ files: [fileOf(await currentPng())], title: 'Postal navideña', text: '¡Mi carta al Viejito Pascuero! 🎄' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareMenu(true); // no se pudo: se ofrecen las otras formas
    }
  };

  // empezar de nuevo sin diálogo del navegador (algunos lo bloquean): se puede deshacer
  const before = useRef<Postcard | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    if (!canUndo) return;
    const t = window.setTimeout(() => setCanUndo(false), 8000);
    return () => window.clearTimeout(t);
  }, [canUndo]);
  const reset = () => {
    if (!p) return;
    before.current = p;
    setSel(null);
    setP({ ...defaultPostcard(nickname), format: p.format });
    setCanUndo(true);
  };
  const undoReset = () => {
    if (before.current) setP(before.current);
    before.current = null;
    setCanUndo(false);
  };

  if (letter.isError) return <Problem text="No encontramos esa carta." />;
  if (letter.isLoading || !p || !stickers || (letter.data?.has_image && photo.isLoading)) return <p className="p-10 text-center font-bold text-marino">Preparando papel y lápices de colores…</p>;
  if (!content) return <Problem text="Esta carta ya no tiene foto ni texto para la postal (la foto se borró por privacidad). Puedes transcribirla en el panel." />;

  const f = FORMATS[p.format];
  const selSticker = sel?.type === 'sticker' ? p.stickers.find((s) => s.id === sel.id) : null;
  const selName = sel?.type === 'carta' ? 'Carta' : selSticker ? STICKERS[selSticker.sticker].label : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/panel" className="inline-flex items-center gap-1.5 text-sm font-extrabold text-marino hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Volver al panel
      </Link>
      <h1 className="mt-2 font-cuento text-4xl text-marino sm:text-5xl">Postal navideña</h1>
      <p className="mt-1 font-bold text-tinta-suave">Decora la carta{nickname ? ` de ${nickname}` : ''} y compártela en tus redes.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* el lienzo queda a la vista mientras se baja por las opciones */}
        <div className="sticky top-0 z-20 -mx-4 self-start bg-[#f3ead8]/95 px-4 pb-2 pt-2 backdrop-blur-sm lg:top-4 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none [--lienzo-h:min(36vh,calc(100vh-260px))] lg:[--lienzo-h:calc(100vh-200px)]">
          <div className="mx-auto" style={{ maxWidth: `min(100%, calc(var(--lienzo-h) * ${f.w / f.h}))` }}>
            <canvas
              ref={canvasRef}
              width={f.w}
              height={f.h}
              tabIndex={0}
              role="img"
              aria-label="Vista previa de la postal. Enter elige la carta o un sticker; las flechas lo mueven; + y - cambian el tamaño; R lo gira; Suprimir quita el sticker."
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={onKey}
              className={clsx(
                'block h-auto w-full cursor-grab touch-none rounded-2xl shadow-papel outline-none ring-oro transition-shadow focus-visible:ring-4 active:cursor-grabbing',
                ghost?.over && 'ring-4',
              )}
            />
          </div>

          <div className="mt-2 flex min-h-[44px] flex-wrap items-center justify-center gap-2" aria-live="polite">
            {sel && selName ? (
              <>
                <span className="mr-1 text-sm font-extrabold text-tinta-suave">{selName}:</span>
                <Tool label="Más chico" onClick={() => edit((it) => ({ size: it.size / 1.12 }))} icon={<Minus size={16} />} />
                <Tool label="Más grande" onClick={() => edit((it) => ({ size: it.size * 1.12 }))} icon={<Plus size={16} />} />
                <Tool label="Girar a la izquierda" onClick={() => edit((it) => ({ rot: it.rot - 0.15 }))} icon={<RotateCcw size={16} />} />
                <Tool label="Girar a la derecha" onClick={() => edit((it) => ({ rot: it.rot + 0.15 }))} icon={<RotateCw size={16} />} />
                {sel.type === 'sticker' && (
                  <>
                    <Tool label="Al frente" onClick={toFront} icon={<BringToFront size={16} />} />
                    <Tool label="Quitar sticker" onClick={removeSel} icon={<Trash2 size={16} />} danger />
                  </>
                )}
              </>
            ) : (
              <p className="text-center text-xs font-bold text-tinta-suave sm:text-sm">Arrastra stickers al lienzo. Toca uno (o la carta) para moverlo, agrandarlo o girarlo.</p>
            )}
          </div>

          <div ref={actionsRef} className="relative mt-2 flex flex-wrap items-center justify-center gap-2">
            <MagicButton variant="rojo" icon={<Share2 size={18} aria-hidden="true" />} onClick={() => void share()} aria-expanded={nativeShare ? undefined : shareMenu}>
              Compartir postal
            </MagicButton>
            {canUndo ? (
              <MagicButton variant="oro" icon={<Undo2 size={16} aria-hidden="true" />} onClick={undoReset}>
                Deshacer
              </MagicButton>
            ) : (
              <MagicButton variant="crema" icon={<RefreshCcw size={16} aria-hidden="true" />} onClick={reset}>
                Empezar de nuevo
              </MagicButton>
            )}
            {shareMenu && (
              <div role="menu" className="absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-2xl bg-white p-2 text-tinta shadow-papel ring-1 ring-black/5">
                <p className="px-2 pb-1 pt-1 text-xs font-bold text-tinta-suave">Este navegador no abre el menú para compartir. Puedes:</p>
                <button type="button" role="menuitem" onClick={() => void copyImage()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-extrabold hover:bg-cielo-claro">
                  <Copy size={16} aria-hidden="true" /> Copiar imagen y pegarla en tu red social
                </button>
                <button type="button" role="menuitem" onClick={() => void download()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-extrabold hover:bg-cielo-claro">
                  <Download size={16} aria-hidden="true" /> Descargar imagen
                </button>
              </div>
            )}
          </div>
          {canUndo && <p className="mt-1 text-center text-xs font-bold text-tinta-suave" role="status">Postal reiniciada. ¿Te arrepentiste? Toca Deshacer.</p>}
        </div>

        <aside className="space-y-4">
          <Panel title="Estilo">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Estilo gráfico">
              {STYLE_IDS.map((st) => (
                <StyleCard key={st} style={st} active={p.style === st} onPick={() => setField('style', st)} />
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-tinta-suave">Cambia el fondo, el borde, los stickers y las letras.</p>
          </Panel>

          <Panel title="Formato">
            <Choice<Format> value={p.format} onChange={(v) => setField('format', v)} options={Object.entries(FORMATS).map(([k, v]) => [k as Format, v.label, v.hint])} />
          </Panel>

          {photo.data && text && (
            <Panel title="La carta">
              <Choice<'foto' | 'texto'>
                value={show}
                onChange={setShow}
                options={[
                  ['foto', 'Foto', 'Como la escribió'],
                  ['texto', 'Texto', 'Transcripción'],
                ]}
              />
            </Panel>
          )}

          <Panel title="Fondo">
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Fondo">
              {(Object.keys(THEMES) as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={p.theme === t}
                  aria-label={THEMES[t].label}
                  title={THEMES[t].label}
                  onClick={() => setField('theme', t)}
                  className={clsx('aspect-square rounded-xl ring-2 transition-transform hover:scale-105', p.theme === t ? 'ring-oro ring-offset-2' : 'ring-black/10')}
                  style={{ background: THEMES[t].swatch }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs font-extrabold text-tinta-suave">{THEMES[p.theme].label}</p>
          </Panel>

          <Panel title="Borde">
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Borde">
              {(Object.keys(FRAMES) as Frame[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={p.frame === k}
                  onClick={() => setField('frame', k)}
                  className={clsx(
                    'rounded-xl px-2 py-2 text-xs font-extrabold leading-tight transition-colors',
                    p.frame === k ? 'bg-oro text-tinta' : 'bg-white text-marino hover:bg-cielo-claro',
                  )}
                >
                  {FRAMES[k]}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" checked={p.snow} onChange={(e) => setField('snow', e.target.checked)} className="h-5 w-5 accent-[var(--verde-muerdago)]" />
              Nieve cayendo
            </label>
          </Panel>

          <Panel title="Textos">
            <label className="block text-sm font-extrabold">
              Título
              <input value={p.title} maxLength={60} onChange={(e) => setField('title', e.target.value)} className="mt-1 w-full rounded-xl border-2 border-marino/20 bg-white px-3 py-1.5 text-sm font-normal focus:border-oro focus:outline-none" />
            </label>
            <label className="mt-2 block text-sm font-extrabold">
              Firma
              <input value={p.signature} maxLength={60} onChange={(e) => setField('signature', e.target.value)} className="mt-1 w-full rounded-xl border-2 border-marino/20 bg-white px-3 py-1.5 text-sm font-normal focus:border-oro focus:outline-none" />
            </label>
          </Panel>

          <Panel title="Stickers">
            {STICKER_GROUPS.map((g) => (
              <div key={g.label} className="mt-3 first:mt-0">
                <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-tinta-suave">{g.label}</h3>
                <div className="grid grid-cols-6 gap-1.5">
                  {g.ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onPointerDown={paletteDown(id)}
                      onPointerMove={paletteMove}
                      onPointerUp={paletteUp}
                      onPointerCancel={paletteCancel}
                      // con teclado (Enter/espacio) no hay arrastre: se agrega al centro
                      onClick={(e) => e.detail === 0 && addSticker(id)}
                      aria-label={`Agregar ${STICKERS[id].label}`}
                      title={STICKERS[id].label}
                      className="grid aspect-square cursor-grab touch-none select-none place-items-center rounded-xl bg-noche-700 p-1.5 transition-transform duration-200 ease-rebote hover:scale-110 active:cursor-grabbing"
                    >
                      <img src={svgUrl(id)} alt="" className="h-full w-full" draggable={false} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Panel>

          <p className="flex gap-2 rounded-2xl bg-hielo/70 p-3 text-xs font-bold text-noche">
            <ShieldAlert size={18} className="shrink-0" aria-hidden="true" />
            Antes de publicar, revisa que en la carta no se vean nombres completos, la dirección, el colegio ni la cara de tu hijo o hija.
          </p>

        </aside>
      </div>
      {ghost && (
        <img
          src={svgUrl(ghost.id)}
          alt=""
          aria-hidden="true"
          className={clsx('pointer-events-none fixed z-50 h-20 w-20 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg transition-transform', ghost.over ? 'scale-110' : 'scale-90 opacity-70')}
          style={{ left: ghost.x, top: ghost.y }}
        />
      )}
    </div>
  );
}

const STYLE_SAMPLE: Record<Style, string> = {
  tradicional: 'linear-gradient(135deg,#24386e,#0d1838)',
  anime: 'linear-gradient(135deg,#ff8cc0,#7f6bff)',
  acuarela: 'radial-gradient(circle at 30% 30%,#ffd6e0,#cfe6ff 60%,#fff6e0)',
  realista: 'radial-gradient(circle at 40% 35%,#6b4a2a,#1b120a)',
  crayon: 'repeating-linear-gradient(-45deg,#ffe066 0 5px,#ffd23f 5px 8px)',
};
const STYLE_INK: Record<Style, { color: string; shadow: string }> = {
  tradicional: { color: '#ffe6a3', shadow: '0 2px 4px rgb(0 0 0 / .5)' },
  anime: { color: '#fff', shadow: '-2px 0 #2b1d3a, 2px 0 #2b1d3a, 0 -2px #2b1d3a, 0 3px #2b1d3a' },
  acuarela: { color: '#c2185b', shadow: '0 0 8px rgb(255 255 255 / .9)' },
  realista: { color: '#f4d77a', shadow: '0 2px 4px rgb(0 0 0 / .8)' },
  crayon: { color: '#d6262f', shadow: 'none' },
};

/** Tarjeta del selector de estilo con una muestra de su letra. */
function StyleCard({ style, active, onPick }: { style: Style; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className={clsx(
        'overflow-hidden rounded-xl text-left ring-2 transition-transform hover:scale-[1.03]',
        active ? 'ring-oro ring-offset-2' : 'ring-black/10',
        style === 'crayon' && 'col-span-2',
      )}
    >
      <span className="grid h-12 place-items-center" style={{ background: STYLE_SAMPLE[style] }}>
        <span style={{ font: FONTS[style].title(24), color: STYLE_INK[style].color, textShadow: STYLE_INK[style].shadow }}>Navidad</span>
      </span>
      <span className="block bg-white px-2 py-1.5">
        <span className="block text-sm font-extrabold text-tinta">{STYLES[style].label}</span>
        <span className="block text-[11px] font-semibold leading-tight text-tinta-suave">{STYLES[style].hint}</span>
      </span>
    </button>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-lg p-10 text-center">
      <p className="font-cuento text-4xl text-rojo">Ups</p>
      <p className="mt-2 font-semibold text-tinta-suave">{text}</p>
      <Link to="/panel" className="mt-4 inline-block font-extrabold text-marino underline">
        Volver al panel
      </Link>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="papel-crema rounded-[1.4rem] p-4 text-tinta shadow-papel">
      <h2 className="mb-2 font-display text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup">
      {options.map(([k, label, hint]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={clsx('rounded-xl px-3 py-2 text-left transition-colors', value === k ? 'bg-oro text-tinta' : 'bg-white text-marino hover:bg-cielo-claro')}
        >
          <span className="block text-sm font-extrabold">{label}</span>
          <span className="block text-xs font-semibold opacity-75">{hint}</span>
        </button>
      ))}
    </div>
  );
}

function Tool({ label, onClick, icon, danger }: { label: string; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx('grid h-10 w-10 place-items-center rounded-full bg-white shadow-papel transition-transform hover:scale-105', danger ? 'text-rojo-baya' : 'text-marino')}
    >
      {icon}
    </button>
  );
}
