import { ReactNode, useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAppContext } from "@/hooks/use-app-context";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { 
    selectedRouterId, 
    setSelectedRouterId, 
    darkMode, 
    toggleDarkMode,
    sidebarOpen,
    setSidebarOpen
  } = useAppContext();

  // Set dark mode class on document when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gray-100 dark:bg-neutral-900 text-neutral-800 dark:text-gray-200 overflow-auto">
      <Header 
        routerId={selectedRouterId}
        setRouterId={setSelectedRouterId}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      <div className="flex flex-1 overflow-auto">
        <Sidebar 
          routerId={selectedRouterId}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 p-4 bg-gray-100 dark:bg-neutral-900 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
