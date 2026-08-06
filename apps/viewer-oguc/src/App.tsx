// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./ui/AppContext";
import Layout from "./components/Layout/Layout";
import RevisionLayout from "./routes/RevisionLayout";

// AppProvider wraps the Router, not the other way around: ApplicationInstance
// (the loaded models, selection, etc.) must survive navigating between "/"
// and "/revision" - both routes are client-side swaps of the same React tree,
// not separate page loads, so a model loaded on "/" is still there when the
// user navigates to "/revision" without any extra bridging (Redux,
// localStorage, etc.) - it's the same AppProvider instance the whole time.
function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />} />
          <Route path="/revision" element={<RevisionLayout />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
