// src/ui/AppContext.tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { createApplication } from "../engine/createApplication";
import type { ApplicationInstance } from "../engine/createApplication";

const AppContext = createContext<ApplicationInstance | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // 🌟 Usamos una función de inicialización perezosa (lazy initial state).
  // Esto garantiza que 'createApplication' se ejecute exactamente UNA sola vez.
  const [application] = useState(() => createApplication());

  return (
    <AppContext.Provider value={application}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp debe ser utilizado dentro de un AppProvider");
  }
  return context;
}