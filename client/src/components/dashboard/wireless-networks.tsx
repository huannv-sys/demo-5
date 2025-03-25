import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface WirelessNetworksProps {
  routerId: number | null;
  isConnected: boolean;
}

export function WirelessNetworks({ routerId, isConnected }: WirelessNetworksProps) {
  // Query for wireless networks
  const { data: wirelessNetworks, isLoading: networksLoading } = useQuery({
    queryKey: ['/api/routers/wireless', routerId],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getWirelessNetworks(routerId);
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Query for wireless clients
  const { data: wirelessClients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/routers/wireless/clients', routerId],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getWirelessClients(routerId);
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const isLoading = networksLoading || clientsLoading;

  // Only show first 3 networks in the table for the dashboard
  const displayNetworks = wirelessNetworks?.slice(0, 3);

  return (
    <Card>
      <div className="border-b border-gray-200 dark:border-neutral-700 px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-medium">Wireless Networks</h2>
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
            Connect to a router to view wireless networks
          </div>
        ) : displayNetworks?.length ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-neutral-850 text-neutral-500 dark:text-neutral-400 text-left text-xs uppercase font-medium">
                <TableHead className="py-3 px-4">SSID</TableHead>
                <TableHead className="py-3 px-4">Interface</TableHead>
                <TableHead className="py-3 px-4">Security</TableHead>
                <TableHead className="py-3 px-4">Clients</TableHead>
                <TableHead className="py-3 px-4">Status</TableHead>
                <TableHead className="py-3 px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-200 dark:divide-neutral-700">
              {displayNetworks.map((network) => (
                <TableRow key={network.id} className="text-sm">
                  <TableCell className="py-3 px-4 font-medium">{network.ssid}</TableCell>
                  <TableCell className="py-3 px-4">{network.interface}</TableCell>
                  <TableCell className="py-3 px-4">{network.security || "None"}</TableCell>
                  <TableCell className="py-3 px-4">{network.clients || 0}</TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="flex items-center">
                      <span className={`w-2 h-2 ${network.disabled ? 'bg-red-500' : 'bg-green-500'} rounded-full mr-2`}></span>
                      <span>{network.disabled ? "Disabled" : "Enabled"}</span>
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-primary-light">
                          <span className="material-icons text-sm">more_vert</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <span className="material-icons mr-2 text-sm">info</span>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <span className="material-icons mr-2 text-sm">edit</span>
                          Edit Network
                        </DropdownMenuItem>
                        <DropdownMenuItem className={network.disabled ? "text-green-600" : "text-red-600"}>
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
        ) : (
          <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
            No wireless networks found
          </div>
        )}
      </div>
      <CardFooter className="border-t border-gray-200 dark:border-neutral-700 px-4 py-3">
        <h3 className="text-sm font-medium mb-2">Connected Clients</h3>
        <div className="grid grid-cols-2 gap-2">
          {wirelessClients?.slice(0, 3).map(client => (
            <div key={client.id} className="bg-gray-50 dark:bg-neutral-850 rounded p-2 flex items-center">
              <span className="material-icons text-neutral-400 mr-2">
                {client.name?.toLowerCase().includes('phone') || client.name?.toLowerCase().includes('iphone') 
                  ? 'smartphone'
                  : client.name?.toLowerCase().includes('tv') 
                    ? 'tv'
                    : 'laptop'}
              </span>
              <div>
                <div className="text-xs font-medium">{client.name || "Unknown Device"}</div>
                <div className="text-xs text-neutral-500">{client.macAddress}</div>
              </div>
              <div className="ml-auto">
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-1.5 py-0.5 rounded">
                  {client.interface}
                </span>
              </div>
            </div>
          ))}
          
          {(!wirelessClients || wirelessClients.length === 0) && (
            <div className="col-span-2 text-center text-neutral-500 dark:text-neutral-400 py-2">
              No wireless clients connected
            </div>
          )}
        </div>
        <div className="w-full text-right mt-4">
          <Link href="/wireless">
            <Button variant="link" size="sm" className="text-primary-light hover:text-primary-dark dark:hover:text-primary text-sm font-medium">
              Manage Wireless
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
