import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { Link } from "wouter";
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
  DialogTitle,
} from "@/components/ui/dialog";
import { getInterfaceStatusInfo } from "@/lib/utils";

interface InterfacesTableProps {
  routerId: number | null;
  isConnected: boolean;
}

export function InterfacesTable({ routerId, isConnected }: InterfacesTableProps) {
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Query for interfaces data
  const { data: interfaces, isLoading } = useQuery({
    queryKey: ['/api/routers/interfaces', routerId],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getInterfaces(routerId);
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Filter interfaces to show only the first 4 for the dashboard
  const displayInterfaces = interfaces?.slice(0, 4);
  
  // Get selected interface details
  const interfaceDetails = interfaces?.find(iface => iface.name === selectedInterface);

  return (
    <Card>
      <div className="border-b border-gray-200 dark:border-neutral-700 px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-medium">Network Interfaces</h2>
        <Button variant="ghost" size="sm" className="text-primary-light hover:text-primary-dark dark:hover:text-primary">
          <span className="material-icons">add_circle</span>
        </Button>
      </div>
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !routerId || !isConnected ? (
          <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
            Connect to a router to view interfaces
          </div>
        ) : displayInterfaces?.length ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-neutral-850 text-neutral-500 dark:text-neutral-400 text-left text-xs uppercase font-medium">
                <TableHead className="py-3 px-4">Name</TableHead>
                <TableHead className="py-3 px-4">Type</TableHead>
                <TableHead className="py-3 px-4">Status</TableHead>
                <TableHead className="py-3 px-4">IP Address</TableHead>
                <TableHead className="py-3 px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-200 dark:divide-neutral-700">
              {displayInterfaces.map((iface) => {
                const statusInfo = getInterfaceStatusInfo(iface.running, iface.disabled);
                const ipAddress = iface.addresses && iface.addresses.length > 0
                  ? iface.addresses[0].address
                  : '—';
                
                return (
                  <TableRow key={iface.name} className="text-sm">
                    <TableCell className="py-3 px-4 font-medium">{iface.name}</TableCell>
                    <TableCell className="py-3 px-4">{iface.type}</TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="flex items-center">
                        <span className={`w-2 h-2 ${statusInfo.indicator} rounded-full mr-2`}></span>
                        <span className={statusInfo.color}>{statusInfo.text}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4">{ipAddress}</TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-primary-light">
                            <span className="material-icons text-sm">more_vert</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedInterface(iface.name);
                            setShowDetailsModal(true);
                          }}>
                            <span className="material-icons mr-2 text-sm">info</span>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <span className="material-icons mr-2 text-sm">edit</span>
                            Edit Interface
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className={iface.disabled ? "text-primary-light" : "text-red-500"}>
                            <span className="material-icons mr-2 text-sm">{iface.disabled ? "play_arrow" : "stop"}</span>
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
        ) : (
          <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
            No interfaces found
          </div>
        )}
      </div>
      <CardFooter className="border-t border-gray-200 dark:border-neutral-700 px-4 py-3 text-right">
        <Link href="/interfaces">
          <Button variant="link" size="sm" className="text-primary-light hover:text-primary-dark dark:hover:text-primary text-sm font-medium">
            View All Interfaces
          </Button>
        </Link>
      </CardFooter>
      
      {/* Interface Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Interface Details: {interfaceDetails?.name}</DialogTitle>
            <DialogDescription>
              Detailed information about this network interface.
            </DialogDescription>
          </DialogHeader>
          
          {interfaceDetails && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Interface Type</p>
                  <p className="font-medium">{interfaceDetails.type}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">MAC Address</p>
                  <p className="font-medium">{interfaceDetails.macAddress || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">MTU</p>
                  <p className="font-medium">{interfaceDetails.mtu || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">L2MTU</p>
                  <p className="font-medium">{interfaceDetails.l2mtu || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Status</p>
                  <p className="font-medium flex items-center">
                    <span className={`w-2 h-2 ${getInterfaceStatusInfo(interfaceDetails.running, interfaceDetails.disabled).indicator} rounded-full mr-2`}></span>
                    {interfaceDetails.disabled ? "Disabled" : interfaceDetails.running ? "Running" : "Down"}
                  </p>
                </div>
              </div>
              
              {interfaceDetails.addresses && interfaceDetails.addresses.length > 0 && (
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
                      {interfaceDetails.addresses.map((addr, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{addr.address}</TableCell>
                          <TableCell>{addr.network}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {(interfaceDetails.rxBytes !== undefined || interfaceDetails.txBytes !== undefined) && (
                <div>
                  <h3 className="text-sm font-medium mt-4 mb-2">Traffic Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">RX Bytes</p>
                      <p className="font-medium">{interfaceDetails.rxBytes ? `${(interfaceDetails.rxBytes / (1024 * 1024)).toFixed(2)} MB` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">TX Bytes</p>
                      <p className="font-medium">{interfaceDetails.txBytes ? `${(interfaceDetails.txBytes / (1024 * 1024)).toFixed(2)} MB` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">RX Packets</p>
                      <p className="font-medium">{interfaceDetails.rxPackets || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">TX Packets</p>
                      <p className="font-medium">{interfaceDetails.txPackets || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowDetailsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
