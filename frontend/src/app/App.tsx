import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig, motion } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { redactEvent } from '@/lib/analytics';
import { Suspense } from 'react';
import { lazyPage } from '@/lib/lazyPage';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { Layout } from './Layout';
import { RequireAuth, SessionBootstrap } from '@/features/auth/session';
import { LandingPage } from '@/pages/LandingPage';
import { SleighLoader } from '@/components/ui/SleighLoader';

const LoginPage = lazyPage(() => import('@/features/auth/LoginPage'));
const PanelPage = lazyPage(() => import('@/features/parents/PanelPage'));
const PostcardPage = lazyPage(() => import('@/features/postcard/PostcardPage'));
const TrackingPage = lazyPage(() => import('@/features/tracking/TrackingPage'));
const PrivacyPage = lazyPage(() => import('@/pages/PrivacyPage'));
const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 2,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function PageFallback() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} className="grid min-h-[60vh] place-items-center px-6">
      <SleighLoader progress={66} label="Abriendo la página" />
    </motion.div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* "reducir movimiento" del sistema: sin desplazamientos ni escalas, solo fundidos */}
      <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <SessionBootstrap />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<LandingPage />} />
              <Route path="entrar" element={<LoginPage mode="login" />} />
              <Route path="registro" element={<LoginPage mode="register" />} />
              <Route
                path="panel/*"
                element={
                  <RequireAuth>
                    <PanelPage />
                  </RequireAuth>
                }
              />
              <Route
                path="postal/:letterId"
                element={
                  <RequireAuth>
                    <PostcardPage />
                  </RequireAuth>
                }
              />
              <Route path="seguimiento/:code" element={<TrackingPage />} />
              <Route path="privacidad" element={<PrivacyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      {/* visitas anónimas (sin cookies); los códigos del niño y los ids de cartas se ocultan */}
      {__VERCEL_ANALYTICS__ && <Analytics beforeSend={redactEvent} />}
      </MotionConfig>
    </QueryClientProvider>
  );
}
