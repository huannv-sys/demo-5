import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mikrotikApi } from '@/lib/mikrotik-api';

export function useConnectionStatus(routerId: number | null) {
  const [connected, setConnected] = useState(false);
  
  const { data: statusData, isLoading } = useQuery({
    queryKey: ['/api/connections/status', routerId],
    queryFn: async () => {
      if (!routerId) return { connected: false };
      return mikrotikApi.getConnectionStatus(routerId);
    },
    enabled: !!routerId,
    refetchInterval: 10000, // Check every 10 seconds
  });
  
  useEffect(() => {
    if (statusData) {
      setConnected(statusData.connected);
    } else {
      setConnected(false);
    }
  }, [statusData]);
  
  return {
    connected,
    isLoading,
    lastConnected: statusData?.lastConnected
  };
}
