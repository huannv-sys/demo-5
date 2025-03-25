import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { RouterConnection } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface RouterContextType {
  currentRouter: RouterInfo | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: (routerId: number) => Promise<void>;
  disconnect: () => Promise<void>;
  availableRouters: RouterInfo[];
  isLoadingRouters: boolean;
  refreshRouters: () => void;
}

interface RouterInfo {
  id: number;
  name: string;
  address: string;
  port: number;
  username: string;
  isDefault: boolean;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [currentRouter, setCurrentRouter] = useState<RouterInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available routers
  const { data: routers, isLoading: isLoadingRouters, refetch: refreshRouters } = useQuery<RouterInfo[]>({
    queryKey: ['/api/connections'],
    staleTime: 60000, // 1 minute
  });

  // Check if there's a default router and attempt to connect to it on startup
  useEffect(() => {
    async function connectToDefaultRouter() {
      try {
        const defaultRouter = routers?.find(router => router.isDefault);
        if (defaultRouter) {
          setCurrentRouter(defaultRouter);
          await checkConnectionStatus(defaultRouter.id);
        }
      } catch (error) {
        console.error('Failed to connect to default router:', error);
      }
    }

    if (routers && routers.length > 0 && !currentRouter) {
      connectToDefaultRouter();
    }
  }, [routers]);

  // Check the connection status for a router
  async function checkConnectionStatus(routerId: number) {
    try {
      const response = await apiRequest('GET', `/api/connections/${routerId}/status`);
      const data = await response.json();
      setIsConnected(data.connected);
      return data.connected;
    } catch (error) {
      console.error('Error checking connection status:', error);
      setIsConnected(false);
      return false;
    }
  }

  // Connect to a router
  async function connect(routerId: number) {
    if (isConnecting) return;
    
    try {
      setIsConnecting(true);
      
      // Find the router in our list
      const router = routers?.find(r => r.id === routerId);
      if (!router) {
        throw new Error('Router not found');
      }
      
      // Connect to the router
      const response = await apiRequest('POST', `/api/connections/${routerId}/connect`);
      const data = await response.json();
      
      if (response.ok) {
        setCurrentRouter(router);
        setIsConnected(true);
        toast({
          title: 'Connected',
          description: `Successfully connected to ${router.name}`,
        });
        
        // Invalidate any router-specific data
        queryClient.invalidateQueries({ queryKey: [`/api/routers/${routerId}/resources`] });
      } else {
        throw new Error(data.message || 'Failed to connect');
      }
    } catch (error) {
      const err = error as Error;
      toast({
        title: 'Connection Failed',
        description: err.message,
        variant: 'destructive',
      });
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }

  // Disconnect from the current router
  async function disconnect() {
    if (!currentRouter) return;
    
    try {
      await apiRequest('POST', `/api/connections/${currentRouter.id}/disconnect`);
      setIsConnected(false);
      toast({
        title: 'Disconnected',
        description: `Disconnected from ${currentRouter.name}`,
      });
    } catch (error) {
      const err = error as Error;
      toast({
        title: 'Disconnect Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <RouterContext.Provider
      value={{
        currentRouter,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        availableRouters: routers || [],
        isLoadingRouters,
        refreshRouters
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}
