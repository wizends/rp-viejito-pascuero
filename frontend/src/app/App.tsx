import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { Layout } from './Layout';
import { RequireAuth, SessionBootstrap } from '@/features/auth/session';
import { LandingPage } from '@/pages/LandingPage';
import { SleighLoader } from '@/components/ui/SleighLoader';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const PanelPage = lazy(() => import('@/features/parents/PanelPage'));
const PostcardPage = lazy(() => import('@/features/postcard/PostcardPage'));
const TrackingPage = lazy(() => import('@/features/tracking/TrackingPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

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
    <div className="grid min-h-[60vh] place-items-center px-6">
      <SleighLoader progress={66} label="Abriendo la página" />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
