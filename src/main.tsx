import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import App from './App.tsx';
import './index.css';

const InvoiceLookup = lazy(() => import('./components/InvoiceLookup.tsx'));
const InvoicePublicView = lazy(() => import('./components/InvoicePublicView.tsx'));

function RouteLoading() {
  return <div className="min-h-screen flex items-center justify-center bg-canvas"><LoaderCircle className="w-8 h-8 animate-spin text-brand" /></div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/track" element={<InvoiceLookup />} />
          <Route path="/invoice/:invoiceId" element={<InvoicePublicView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
