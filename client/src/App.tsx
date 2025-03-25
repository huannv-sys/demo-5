import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AppContext } from "./context/app-context";
import { useDarkMode } from "./hooks/use-dark-mode";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "./lib/mikrotik-api";

// Pages
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Interfaces from "@/pages/interfaces";
import Wireless from "@/pages/wireless";
import Firewall from "@/pages/firewall";
import Logs from "@/pages/logs";
import Users from "@/pages/users";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout/layout";

function Router() {
  const [location] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedRouterId, setSelectedRouterId] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { darkMode, toggleDarkMode } = useDarkMode();

  // Check authentication status on app load
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth/status'],
    queryFn: async () => {
      try {
        return await mikrotikApi.checkAuthStatus();
      } catch (error) {
        console.error("Auth check failed:", error);
        return { authenticated: false };
      }
    },
  });

  // Get default router if available
  const { data: connections } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => {
      if (!authData?.authenticated) return null;
      return mikrotikApi.getConnections();
    },
    enabled: !!authData?.authenticated,
  });

  // Set default router on first load
  useEffect(() => {
    if (connections && connections.length > 0 && !selectedRouterId) {
      // Find default connection or use the first one
      const defaultConnection = connections.find(c => c.isDefault) || connections[0];
      setSelectedRouterId(defaultConnection.id);
    }
  }, [connections, selectedRouterId]);

  // Update authentication status when auth data changes
  useEffect(() => {
    if (authData !== undefined) {
      setIsAuthenticated(authData.authenticated);
    }
  }, [authData]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isAuthenticated === false && location !== "/login") {
      window.location.href = "/login";
    } else if (isAuthenticated === true && location === "/login") {
      window.location.href = "/";
    }
  }, [isAuthenticated, location]);

  // Show loading state while checking authentication
  if (authLoading || isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ 
      selectedRouterId, 
      setSelectedRouterId,
      connected,
      setConnected,
      darkMode,
      toggleDarkMode,
      sidebarOpen,
      setSidebarOpen
    }}>
      <Switch>
        <Route path="/login" component={Login} />
        
        {/* Protected Routes */}
        {isAuthenticated && (
          <>
            <Route path="/">
              <Layout>
                <Dashboard />
              </Layout>
            </Route>
            <Route path="/interfaces">
              <Layout>
                <Interfaces />
              </Layout>
            </Route>
            <Route path="/wireless">
              <Layout>
                <Wireless />
              </Layout>
            </Route>
            <Route path="/firewall">
              <Layout>
                <Firewall />
              </Layout>
            </Route>
            <Route path="/logs">
              <Layout>
                <Logs />
              </Layout>
            </Route>
            <Route path="/users">
              <Layout>
                <Users />
              </Layout>
            </Route>
          </>
        )}
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </AppContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
