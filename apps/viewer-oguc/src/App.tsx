// src/App.tsx
import { AppProvider } from "./ui/AppContext";
import Layout from "./components/Layout/Layout";

function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}

export default App;