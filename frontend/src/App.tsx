import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { queryClient } from './lib/queryClient';
import { useAuth } from './stores/auth';
import { setAuthToken, setOnUnauthorized } from './lib/api';
import './styles/index.css';

function AppContent() {
  const { token, clear } = useAuth();

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      setOnUnauthorized(() => {
        clear();
        window.location.href = '/login';
      });
    }
  }, [token, clear]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/">
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

export default AppContent;
