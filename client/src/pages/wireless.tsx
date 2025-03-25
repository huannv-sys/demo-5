import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { useAppContext } from "@/hooks/use-app-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Wireless, WirelessClient } from "@shared/schema";

export default function WirelessPage() {
  const { selectedRouterId, connected } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWireless, setSelectedWireless] = useState<Wireless | null>(null);
  const [selectedClient, setSelectedClient] = useState<WirelessClient | null>(null);
  const [showNetworkDetails, setShowNetworkDetails] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);

  // Query for wireless networks
  const { data: wirelessNetworks, isLoading: networksLoading } = useQuery({
    queryKey: ['/api/routers/wireless', selectedRouterId],
    queryFn: async () => {
      if (!selectedRouterId || !connected) return null;
      return mikrotikApi.getWirelessNetworks(selectedRouterId);
    },
    enabled: !!selectedRouterId && connected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Query for wireless clients
  const { data: wirelessClients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/routers/wireless/clients', selectedRouterId],
    queryFn: async () => {
      if (!selectedRouterId || !connected) return null;
      return mikrotikApi.getWirelessClients(selectedRouterId);
    },
    enabled: !!selectedRouterId && connected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Toggle wireless network status mutation
  const toggleWirelessMutation = useMutation({
    mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
      if (!selectedRouterId) throw new Error("No router selected");
      
      // This would be a real API call in production
      return mikrotikApi.executeCommand(
        selectedRouterId,
        `/interface wireless ${disabled ? 'enable' : 'disable'} ${id}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/routers/wireless', selectedRouterId] });
      toast({
        title: "Success",
        description: `Wireless network ${selectedWireless?.disabled ? "enabled" : "disabled"} successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Operation Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  const handleToggleWireless = (network: Wireless) => {
    setSelectedWireless(network);
    toggleWirelessMutation.mutate({
      id: network.id,
      disabled: network.disabled
    });
  };

  const showWirelessDetails = (network: Wireless) => {
    setSelectedWireless(network);
    setShowNetworkDetails(true);
  };

  const showWirelessClientDetails = (client: WirelessClient) => {
    setSelectedClient(client);
    setShowClientDetails(true);
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-medium">Wireless Management</h1>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/routers/wireless', selectedRouterId] });
            queryClient.invalidateQueries({ queryKey: ['/api/routers/wireless/clients', selectedRouterId] });
          }}
          className="flex items-center"
        >
          <span className="material-icons mr-1 text-sm">refresh</span>
          <span>Refresh</span>
        </Button>
      </div>

      <Tabs defaultValue="networks" className="w-full mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="networks">Wireless Networks</TabsTrigger>
          <TabsTrigger value="clients">Connected Clients</TabsTrigger>
        </TabsList>

        <TabsContent value="networks">
          <Card>
            <CardHeader>
              <CardTitle>Wireless Networks</CardTitle>
              <CardDescription>
                Manage wireless networks on your MikroTik router
              </CardDescription>
            </CardHeader>
            <CardContent>
              {networksLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !selectedRouterId || !connected ? (
                <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                  Connect to a router to view wireless networks
                </div>
              ) : wirelessNetworks?.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-neutral-850">
                        <TableHead>SSID</TableHead>
                        <TableHead>Interface</TableHead>
                        <TableHead>Security</TableHead>
                        <TableHead>Band</TableHead>
                        <TableHead>Clients</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wirelessNetworks.map((network) => (
                        <TableRow key={network.id}>
                          <TableCell className="font-medium">{network.ssid}</TableCell>
                          <TableCell>{network.interface}</TableCell>
                          <TableCell>{network.security || "None"}</TableCell>
                          <TableCell>{network.band || "—"}</TableCell>
                          <TableCell>{network.clients || 0}</TableCell>
                          <TableCell>
                            <span className="flex items-center">
                              <span className={`w-2 h-2 ${network.disabled ? 'bg-red-500' : 'bg-green-500'} rounded-full mr-2`}></span>
                              <span>{network.disabled ? "Disabled" : "Enabled"}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <span className="material-icons text-sm">more_vert</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => showWirelessDetails(network)}>
                                  <span className="material-icons mr-2 text-sm">info</span>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <span className="material-icons mr-2 text-sm">edit</span>
                                  Edit Network
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleToggleWireless(network)}
                                  className={network.disabled ? "text-green-600" : "text-red-600"}
                                >
                                  <span className="material-icons mr-2 text-sm">
                                    {network.disabled ? "play_arrow" : "stop"}
                                  </span>
                                  {network.disabled ? "Enable Network" : "Disable Network"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                  No wireless networks found
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button>
                <span className="material-icons mr-2 text-sm">add_circle</span>
                Add New Network
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle>Connected Clients</CardTitle>
              <CardDescription>
                View and manage clients connected to wireless networks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !selectedRouterId || !connected ? (
                <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                  Connect to a router to view wireless clients
                </div>
              ) : wirelessClients?.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-neutral-850">
                        <TableHead>Name</TableHead>
                        <TableHead>MAC Address</TableHead>
                        <TableHead>Interface</TableHead>
                        <TableHead>Signal</TableHead>
                        <TableHead>TX/RX Rate</TableHead>
                        <TableHead>Uptime</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wirelessClients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.name || "Unknown Device"}</TableCell>
                          <TableCell>{client.macAddress}</TableCell>
                          <TableCell>{client.interface}</TableCell>
                          <TableCell>{client.signalStrength ? `${client.signalStrength} dBm` : "—"}</TableCell>
                          <TableCell>
                            {client.txRate && client.rxRate ? (
                              <div className="text-xs">
                                <div>TX: {(client.txRate / 1000000).toFixed(1)} Mbps</div>
                                <div>RX: {(client.rxRate / 1000000).toFixed(1)} Mbps</div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{client.uptime || "—"}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <span className="material-icons text-sm">more_vert</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => showWirelessClientDetails(client)}>
                                  <span className="material-icons mr-2 text-sm">info</span>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600">
                                  <span className="material-icons mr-2 text-sm">block</span>
                                  Disconnect Client
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                  No wireless clients connected
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Wireless Network Details Dialog */}
      <Dialog open={showNetworkDetails} onOpenChange={setShowNetworkDetails}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Wireless Network: {selectedWireless?.ssid}</DialogTitle>
            <DialogDescription>
              Detailed information about this wireless network.
            </DialogDescription>
          </DialogHeader>
          
          {selectedWireless && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Interface</p>
                  <p className="font-medium">{selectedWireless.interface}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Security</p>
                  <p className="font-medium">{selectedWireless.security || "None"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Band</p>
                  <p className="font-medium">{selectedWireless.band || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Frequency</p>
                  <p className="font-medium">{selectedWireless.frequency ? `${selectedWireless.frequency} MHz` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Channel</p>
                  <p className="font-medium">{selectedWireless.channel || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Mode</p>
                  <p className="font-medium">{selectedWireless.mode || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Status</p>
                  <p className="font-medium flex items-center">
                    <span className={`w-2 h-2 ${selectedWireless.disabled ? 'bg-red-500' : 'bg-green-500'} rounded-full mr-2`}></span>
                    {selectedWireless.disabled ? "Disabled" : "Enabled"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Connected Clients</p>
                  <p className="font-medium">{selectedWireless.clients || 0}</p>
                </div>
              </div>
              
              {/* Connected clients to this network would be shown here */}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setShowNetworkDetails(false)}
            >
              Close
            </Button>
            <Button 
              variant={selectedWireless?.disabled ? "default" : "destructive"}
              onClick={() => {
                if (selectedWireless) {
                  handleToggleWireless(selectedWireless);
                  setShowNetworkDetails(false);
                }
              }}
            >
              <span className="material-icons mr-1 text-sm">
                {selectedWireless?.disabled ? "play_arrow" : "stop"}
              </span>
              {selectedWireless?.disabled ? "Enable Network" : "Disable Network"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wireless Client Details Dialog */}
      <Dialog open={showClientDetails} onOpenChange={setShowClientDetails}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Client: {selectedClient?.name || selectedClient?.macAddress}</DialogTitle>
            <DialogDescription>
              Detailed information about this wireless client.
            </DialogDescription>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">MAC Address</p>
                  <p className="font-medium">{selectedClient.macAddress}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Interface</p>
                  <p className="font-medium">{selectedClient.interface}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Signal Strength</p>
                  <p className="font-medium">{selectedClient.signalStrength ? `${selectedClient.signalStrength} dBm` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">TX Rate</p>
                  <p className="font-medium">{selectedClient.txRate ? `${(selectedClient.txRate / 1000000).toFixed(1)} Mbps` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">RX Rate</p>
                  <p className="font-medium">{selectedClient.rxRate ? `${(selectedClient.rxRate / 1000000).toFixed(1)} Mbps` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Uptime</p>
                  <p className="font-medium">{selectedClient.uptime || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Last Activity</p>
                  <p className="font-medium">{selectedClient.lastActivity ? `${selectedClient.lastActivity} seconds ago` : "—"}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setShowClientDetails(false)}
            >
              Close
            </Button>
            <Button 
              variant="destructive"
            >
              <span className="material-icons mr-1 text-sm">block</span>
              Disconnect Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
