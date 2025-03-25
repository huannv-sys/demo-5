import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { useAppContext } from "@/hooks/use-app-context";
import { getInterfaceStatusInfo, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
import { Interface } from "@shared/schema";

export default function Interfaces() {
  const { selectedRouterId, connected } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInterface, setSelectedInterface] = useState<Interface | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Query for interfaces data
  const { data: interfaces, isLoading } = useQuery({
    queryKey: ['/api/routers/interfaces', selectedRouterId],
    queryFn: async () => {
      if (!selectedRouterId || !connected) return null;
      return mikrotikApi.getInterfaces(selectedRouterId);
    },
    enabled: !!selectedRouterId && connected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Mock mutation for toggling interface state (enable/disable)
  // In a real implementation, this would call the appropriate RouterOS API
  const toggleInterfaceMutation = useMutation({
    mutationFn: async ({ name, disabled }: { name: string; disabled: boolean }) => {
      if (!selectedRouterId) throw new Error("No router selected");
      
      // This would be a real API call in production
      return mikrotikApi.executeCommand(
        selectedRouterId,
        `/interface ${disabled ? 'enable' : 'disable'} ${name}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/routers/interfaces', selectedRouterId] });
      toast({
        title: "Success",
        description: `Interface ${selectedInterface?.disabled ? "enabled" : "disabled"} successfully`,
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

  const handleToggleInterface = (iface: Interface) => {
    toggleInterfaceMutation.mutate({
      name: iface.name,
      disabled: iface.disabled
    });
  };

  const showInterfaceDetails = (iface: Interface) => {
    setSelectedInterface(iface);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-medium">Network Interfaces</h1>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/routers/interfaces', selectedRouterId] })}
          className="flex items-center"
        >
          <span className="material-icons mr-1 text-sm">refresh</span>
          <span>Refresh</span>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Interface List</CardTitle>
          <CardDescription>
            Manage network interfaces on your MikroTik router
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !selectedRouterId || !connected ? (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              Connect to a router to view interfaces
            </div>
          ) : interfaces?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-neutral-850">
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>TX/RX</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interfaces.map((iface) => {
                    const statusInfo = getInterfaceStatusInfo(iface.running, iface.disabled);
                    const ipAddress = iface.addresses && iface.addresses.length > 0
                      ? iface.addresses[0].address
                      : '—';
                    
                    return (
                      <TableRow key={iface.name}>
                        <TableCell className="font-medium">{iface.name}</TableCell>
                        <TableCell>{iface.type}</TableCell>
                        <TableCell>{iface.macAddress || "—"}</TableCell>
                        <TableCell>
                          <span className="flex items-center">
                            <span className={`w-2 h-2 ${statusInfo.indicator} rounded-full mr-2`}></span>
                            <span className={statusInfo.color}>{statusInfo.text}</span>
                          </span>
                        </TableCell>
                        <TableCell>{ipAddress}</TableCell>
                        <TableCell>
                          {iface.txBytes && iface.rxBytes ? (
                            <div className="text-xs">
                              <div>TX: {formatBytes(iface.txBytes)}</div>
                              <div>RX: {formatBytes(iface.rxBytes)}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <span className="material-icons text-sm">more_vert</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => showInterfaceDetails(iface)}>
                                <span className="material-icons mr-2 text-sm">info</span>
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <span className="material-icons mr-2 text-sm">edit</span>
                                Edit Interface
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleToggleInterface(iface)}
                                className={iface.disabled ? "text-green-600" : "text-red-600"}
                              >
                                <span className="material-icons mr-2 text-sm">
                                  {iface.disabled ? "play_arrow" : "stop"}
                                </span>
                                {iface.disabled ? "Enable Interface" : "Disable Interface"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              No interfaces found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interface Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Interface Details: {selectedInterface?.name}</DialogTitle>
            <DialogDescription>
              Detailed information about this network interface.
            </DialogDescription>
          </DialogHeader>
          
          {selectedInterface && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Interface Type</p>
                  <p className="font-medium">{selectedInterface.type}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">MAC Address</p>
                  <p className="font-medium">{selectedInterface.macAddress || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">MTU</p>
                  <p className="font-medium">{selectedInterface.mtu || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">L2MTU</p>
                  <p className="font-medium">{selectedInterface.l2mtu || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Status</p>
                  <p className="font-medium flex items-center">
                    <span className={`w-2 h-2 ${getInterfaceStatusInfo(selectedInterface.running, selectedInterface.disabled).indicator} rounded-full mr-2`}></span>
                    {selectedInterface.disabled ? "Disabled" : selectedInterface.running ? "Running" : "Down"}
                  </p>
                </div>
              </div>
              
              {selectedInterface.addresses && selectedInterface.addresses.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mt-4 mb-2">IP Addresses</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead>Network</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInterface.addresses.map((addr, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{addr.address}</TableCell>
                          <TableCell>{addr.network}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {(selectedInterface.rxBytes !== undefined || selectedInterface.txBytes !== undefined) && (
                <div>
                  <h3 className="text-sm font-medium mt-4 mb-2">Traffic Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">RX Bytes</p>
                      <p className="font-medium">{selectedInterface.rxBytes ? formatBytes(selectedInterface.rxBytes) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">TX Bytes</p>
                      <p className="font-medium">{selectedInterface.txBytes ? formatBytes(selectedInterface.txBytes) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">RX Packets</p>
                      <p className="font-medium">{selectedInterface.rxPackets || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">TX Packets</p>
                      <p className="font-medium">{selectedInterface.txPackets || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
