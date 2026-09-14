import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { AppRouter } from '@/app/router';
import { PublicFeedbackPage } from '@/features/feedback/pages/PublicFeedbackPage';
import { ConfirmProvider } from '@/shared/ui/ConfirmDialog';
import { ToastProvider } from '@/shared/ui/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * /feedback is mounted outside AuthProvider so stale admin sessions can never
 * redirect attendees to /login.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/feedback" element={<PublicFeedbackPage />} />
              <Route
                path="*"
                element={
                  <AuthProvider>
                    <AppRouter />
                  </AuthProvider>
                }
              />
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
