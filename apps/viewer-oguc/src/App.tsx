// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./ui/AppContext";
import { ToastProvider } from "./ui/Toast/ToastContext";
import Layout from "./components/Layout/Layout";
import RevisionLayout from "./routes/RevisionLayout";

// AppProvider wraps the Router, not the other way around: ApplicationInstance
// (the loaded models, selection, etc.) must survive navigating between "/"
// and "/revision" - both routes are client-side swaps of the same React tree,
// not separate page loads, so a model loaded on "/" is still there when the
// user navigates to "/revision" without any extra bridging (Redux,
// localStorage, etc.) - it's the same AppProvider instance the whole time.
// ToastProvider wraps at the same level - /revision's save/load/export flow
// is the first consumer, but a toast stack is app-wide UI, not route-owned.
function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />} />
            <Route path="/revision" element={<RevisionLayout />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}

export default App;
