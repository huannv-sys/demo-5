import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface FirewallSummaryProps {
  routerId: number | null;
  isConnected: boolean;
}

export function FirewallSummary({ routerId, isConnected }: FirewallSummaryProps) {
  // Query for firewall rules by chain
  const { data: inputRules, isLoading: inputLoading } = useQuery({
    queryKey: ['/api/routers/firewall/input', routerId],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getFirewallRules(routerId, 'input');
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const { data: forwardRules, isLoading: forwardLoading } = useQuery({
    queryKey: ['/api/routers/firewall/forward', routerId],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getFirewallRules(routerId, 'forward');
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Get all rules to find top traffic rules
  const { data: allRules, isLoading: allRulesLoading } = useQuery({
    queryKey: ['/api/routers/firewall', routerId],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getFirewallRules(routerId);
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Sort rules by packet count to get top traffic rules
  const topTrafficRules = allRules
    ? [...allRules].sort((a, b) => (b.packets || 0) - (a.packets || 0)).slice(0, 3)
    : [];

  const isLoading = inputLoading || forwardLoading || allRulesLoading;

  // Count active chains
  const activeInputChains = inputRules
    ? new Set(inputRules.map(rule => rule.chain)).size
    : 0;
  
  const activeForwardChains = forwardRules
    ? new Set(forwardRules.map(rule => rule.chain)).size
    : 0;

  return (
    <Card>
      <div className="border-b border-gray-200 dark:border-neutral-700 px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-medium">Firewall Status</h2>
        <Button variant="ghost" size="sm" className="text-primary-light hover:text-primary-dark dark:hover:text-primary">
          <span className="material-icons">edit</span>
        </Button>
      </div>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !routerId || !isConnected ? (
          <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
            Connect to a router to view firewall status
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-neutral-850 p-3 rounded">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium">Input Rules</div>
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-2xl font-bold">{inputRules?.length || 0}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {activeInputChains} active chains
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-neutral-850 p-3 rounded">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium">Forward Rules</div>
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-2xl font-bold">{forwardRules?.length || 0}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {activeForwardChains} active chains
                </div>
              </div>
            </div>
              
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Top Traffic by Rule</h3>
              {topTrafficRules.length > 0 ? (
                topTrafficRules.map((rule, index) => (
                  <div key={rule.id} className="bg-gray-50 dark:bg-neutral-850 rounded p-3 mt-2 first:mt-0">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs text-neutral-700 dark:text-neutral-300">
                        {rule.comment || `${rule.action} (${rule.chain})`}
                      </div>
                      <div className="text-xs font-medium">{rule.packets || 0} packets</div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          index === 0 ? 'bg-red-500' : index === 1 ? 'bg-green-500' : 'bg-yellow-500'
                        }`} 
                        style={{ 
                          width: `${Math.min(
                            (rule.packets || 0) / (topTrafficRules[0].packets || 1) * 100, 100
                          )}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-neutral-500 dark:text-neutral-400 py-2">
                  No traffic data available
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t border-gray-200 dark:border-neutral-700 px-4 py-3 text-right">
        <Link href="/firewall">
          <Button variant="link" size="sm" className="text-primary-light hover:text-primary-dark dark:hover:text-primary text-sm font-medium">
            Manage Firewall Rules
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
