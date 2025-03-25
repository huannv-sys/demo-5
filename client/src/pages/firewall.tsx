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
import { Badge } from "@/components/ui/badge";
import { FirewallRule } from "@shared/schema";
import { formatBytes } from "@/lib/utils";

export default function Firewall() {
  const { selectedRouterId, connected } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [selectedRule, setSelectedRule] = useState<FirewallRule | null>(null);
  const [showRuleDetails, setShowRuleDetails] = useState(false);

  // Query for firewall rules
  const { data: firewallRules, isLoading } = useQuery({
    queryKey: ['/api/routers/firewall', selectedRouterId, selectedChain],
    queryFn: async () => {
      if (!selectedRouterId || !connected) return null;
      return mikrotikApi.getFirewallRules(
        selectedRouterId, 
        selectedChain === "all" ? undefined : selectedChain
      );
    },
    enabled: !!selectedRouterId && connected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Toggle firewall rule status mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
      if (!selectedRouterId) throw new Error("No router selected");
      
      // This would be a real API call in production
      return mikrotikApi.executeCommand(
        selectedRouterId,
        `/ip firewall filter ${disabled ? 'enable' : 'disable'} ${id}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/routers/firewall', selectedRouterId] });
      toast({
        title: "Success",
        description: `Firewall rule ${selectedRule?.disabled ? "enabled" : "disabled"} successfully`,
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

  const handleToggleRule = (rule: FirewallRule) => {
    setSelectedRule(rule);
    toggleRuleMutation.mutate({
      id: rule.id,
      disabled: rule.disabled
    });
  };

  const showRuleDetailsDialog = (rule: FirewallRule) => {
    setSelectedRule(rule);
    setShowRuleDetails(true);
  };

  // Get action color
  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'accept':
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case 'drop':
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case 'reject':
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    }
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-medium">Firewall Rules</h1>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/routers/firewall', selectedRouterId] })}
          className="flex items-center"
        >
          <span className="material-icons mr-1 text-sm">refresh</span>
          <span>Refresh</span>
        </Button>
      </div>

      <Tabs defaultValue="filter" className="w-full mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="filter">Filter Rules</TabsTrigger>
          <TabsTrigger value="nat">NAT Rules</TabsTrigger>
          <TabsTrigger value="mangle">Mangle Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="filter">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Filter Rules</CardTitle>
                  <CardDescription>
                    Manage packet filtering rules on your MikroTik router
                  </CardDescription>
                </div>
                <div>
                  <select 
                    className="bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded shadow-sm px-3 py-2 border border-gray-300 dark:border-neutral-700"
                    value={selectedChain}
                    onChange={(e) => setSelectedChain(e.target.value)}
                  >
                    <option value="all">All Chains</option>
                    <option value="input">Input Chain</option>
                    <option value="forward">Forward Chain</option>
                    <option value="output">Output Chain</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !selectedRouterId || !connected ? (
                <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                  Connect to a router to view firewall rules
                </div>
              ) : firewallRules?.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-neutral-850">
                        <TableHead>Chain</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Source Address</TableHead>
                        <TableHead>Destination Address</TableHead>
                        <TableHead>Protocol</TableHead>
                        <TableHead>Port</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {firewallRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{rule.chain}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getActionColor(rule.action)}>
                              {rule.action}
                            </Badge>
                          </TableCell>
                          <TableCell>{rule.srcAddress || "any"}</TableCell>
                          <TableCell>{rule.dstAddress || "any"}</TableCell>
                          <TableCell>{rule.protocol || "any"}</TableCell>
                          <TableCell>{rule.dstPort || "any"}</TableCell>
                          <TableCell>{rule.comment || "—"}</TableCell>
                          <TableCell>
                            <span className="flex items-center">
                              <span className={`w-2 h-2 ${rule.disabled ? 'bg-red-500' : 'bg-green-500'} rounded-full mr-2`}></span>
                              <span>{rule.disabled ? "Disabled" : "Enabled"}</span>
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
                                <DropdownMenuItem onClick={() => showRuleDetailsDialog(rule)}>
                                  <span className="material-icons mr-2 text-sm">info</span>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <span className="material-icons mr-2 text-sm">edit</span>
                                  Edit Rule
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleToggleRule(rule)}
                                  className={rule.disabled ? "text-green-600" : "text-red-600"}
                                >
                                  <span className="material-icons mr-2 text-sm">
                                    {rule.disabled ? "play_arrow" : "stop"}
                                  </span>
                                  {rule.disabled ? "Enable Rule" : "Disable Rule"}
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
                  No firewall rules found
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button>
                <span className="material-icons mr-2 text-sm">add_circle</span>
                Add New Rule
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="nat">
          <Card>
            <CardHeader>
              <CardTitle>NAT Rules</CardTitle>
              <CardDescription>
                Network Address Translation rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                NAT rules will be implemented in a future update
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mangle">
          <Card>
            <CardHeader>
              <CardTitle>Mangle Rules</CardTitle>
              <CardDescription>
                Traffic marking rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                Mangle rules will be implemented in a future update
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Firewall Rule Details Dialog */}
      <Dialog open={showRuleDetails} onOpenChange={setShowRuleDetails}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Firewall Rule Details</DialogTitle>
            <DialogDescription>
              Detailed information about this firewall rule.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRule && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Chain</p>
                  <p className="font-medium">{selectedRule.chain}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Action</p>
                  <p className="font-medium">
                    <Badge variant="outline" className={getActionColor(selectedRule.action)}>
                      {selectedRule.action}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Source Address</p>
                  <p className="font-medium">{selectedRule.srcAddress || "any"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Destination Address</p>
                  <p className="font-medium">{selectedRule.dstAddress || "any"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Protocol</p>
                  <p className="font-medium">{selectedRule.protocol || "any"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Source Port</p>
                  <p className="font-medium">{selectedRule.srcPort || "any"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Destination Port</p>
                  <p className="font-medium">{selectedRule.dstPort || "any"}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Status</p>
                  <p className="font-medium flex items-center">
                    <span className={`w-2 h-2 ${selectedRule.disabled ? 'bg-red-500' : 'bg-green-500'} rounded-full mr-2`}></span>
                    {selectedRule.disabled ? "Disabled" : "Enabled"}
                  </p>
                </div>
              </div>
              
              {selectedRule.comment && (
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Comment</p>
                  <p className="font-medium">{selectedRule.comment}</p>
                </div>
              )}
              
              {(selectedRule.bytes !== undefined || selectedRule.packets !== undefined) && (
                <div>
                  <h3 className="text-sm font-medium mt-4 mb-2">Traffic Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">Bytes</p>
                      <p className="font-medium">{selectedRule.bytes ? formatBytes(selectedRule.bytes) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">Packets</p>
                      <p className="font-medium">{selectedRule.packets || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setShowRuleDetails(false)}
            >
              Close
            </Button>
            <Button 
              variant={selectedRule?.disabled ? "default" : "destructive"}
              onClick={() => {
                if (selectedRule) {
                  handleToggleRule(selectedRule);
                  setShowRuleDetails(false);
                }
              }}
            >
              <span className="material-icons mr-1 text-sm">
                {selectedRule?.disabled ? "play_arrow" : "stop"}
              </span>
              {selectedRule?.disabled ? "Enable Rule" : "Disable Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
