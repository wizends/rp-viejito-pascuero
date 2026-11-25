import { AnimatePresence, motion } from 'framer-motion';
import { create } from 'zustand';
import { Star, X } from 'lucide-react';

interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}

interface ToastState {
  items: ToastItem[];
  push: (text: string, tone?: ToastItem['tone']) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (text, tone = 'ok') => {
    const id = ++seq;
    set({ items: [...get().items, { id, text, tone }] });
    setTimeout(() => get().dismiss(id), 5200);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export const toast = (text: string, tone?: ToastItem['tone']) => useToasts.getState().push(text, tone);

/** Avisos tipo "etiqueta de regalo" en la esquina; anunciados por lectores de pantalla. */
export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={
              'papel-crema pointer-events-auto flex items-start gap-3 rounded-2xl border-2 p-3 pr-2 shadow-papel ' +
              (t.tone === 'error' ? 'border-rojo' : t.tone === 'info' ? 'border-noche-600' : 'border-muerdago') +
              ' relative overflow-hidden'
            }
          >
            {/* cinta que se acorta: cuánto le queda al aviso */}
            <motion.span
              aria-hidden="true"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 5.2, ease: 'linear' }}
              style={{ originX: 0 }}
              className={'absolute inset-x-0 bottom-0 h-1 ' + (t.tone === 'error' ? 'bg-rojo' : t.tone === 'info' ? 'bg-noche-600' : 'bg-muerdago')}
            />
            <Star className={t.tone === 'error' ? 'text-rojo' : 'text-canela'} size={20} aria-hidden="true" />
            <p className="flex-1 text-sm font-bold text-tinta">{t.text}</p>
            <motion.button
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.85 }}
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-full p-1 text-tinta-suave hover:bg-kraft/40"
              aria-label="Cerrar aviso"
            >
              <X size={16} />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
