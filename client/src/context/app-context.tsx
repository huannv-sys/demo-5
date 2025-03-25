import { createContext } from "react";

interface AppContextType {
  selectedRouterId: number | null;
  setSelectedRouterId: (id: number | null) => void;
  connected: boolean;
  setConnected: (connected: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const AppContext = createContext<AppContextType>({
  selectedRouterId: null,
  setSelectedRouterId: () => {},
  connected: false,
  setConnected: () => {},
  darkMode: false,
  toggleDarkMode: () => {},
  sidebarOpen: true,
  setSidebarOpen: () => {}
});
