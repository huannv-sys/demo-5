import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { mikrotikApi } from '@/lib/mikrotik-api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useMikrotik(routerId: number | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  
  // Query to get connection status
  const { data: connectionStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/connections/status', routerId],
    queryFn: async () => {
      if (!routerId) return { connected: false };
      try {
        return await mikrotikApi.getConnectionStatus(routerId);
      } catch (error) {
        console.error('Failed to get connection status:', error);
        return { connected: false };
      }
    },
    enabled: !!routerId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Update local connection state when query data changes
  useEffect(() => {
    if (connectionStatus) {
      setIsConnected(connectionStatus.connected);
    }
  }, [connectionStatus]);

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!routerId) throw new Error('No router selected');
      return mikrotikApi.connectToRouter(routerId);
    },
    onSuccess: () => {
      setIsConnected(true);
      toast({
        title: 'Connected',
        description: 'Successfully connected to the router',
        variant: 'default',
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/connections/status', routerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/routers', routerId] });
    },
    onError: (error) => {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to the router',
        variant: 'destructive',
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!routerId) throw new Error('No router selected');
      return mikrotikApi.disconnectFromRouter(routerId);
    },
    onSuccess: () => {
      setIsConnected(false);
      toast({
        title: 'Disconnected',
        description: 'Successfully disconnected from the router',
        variant: 'default',
      });
      // Invalidate status query
      queryClient.invalidateQueries({ queryKey: ['/api/connections/status', routerId] });
    },
    onError: (error) => {
      toast({
        title: 'Disconnection Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect from the router',
        variant: 'destructive',
      });
    },
  });

  // Connect to router
  const connect = useCallback(() => {
    if (!routerId) {
      toast({
        title: 'Connection Error',
        description: 'No router selected',
        variant: 'destructive',
      });
      return;
    }
    
    connectMutation.mutate();
  }, [routerId, connectMutation, toast]);

  // Disconnect from router
  const disconnect = useCallback(() => {
    if (!routerId) {
      toast({
        title: 'Disconnection Error',
        description: 'No router selected',
        variant: 'destructive',
      });
      return;
    }
    
    disconnectMutation.mutate();
  }, [routerId, disconnectMutation, toast]);

  return {
    isConnected,
    connecting: connectMutation.isPending,
    disconnecting: disconnectMutation.isPending,
    connect,
    disconnect,
    refetchStatus,
    connectionStatus,
  };
}
