import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { App } from './App.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Relationship / effective-label data must not sit "fresh" for long —
      // staleTime: 0 means remounts and invalidations always refetch.
      staleTime: 0,
      // Revisit the tab after linking elsewhere → pick up new chips without restart.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  );
}

