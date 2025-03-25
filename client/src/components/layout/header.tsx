import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMikrotik } from "@/hooks/use-mikrotik";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getConnectionStatusInfo } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type HeaderProps = {
  routerId: number | null;
  setRouterId: (id: number | null) => void;
  onToggleSidebar: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
};

export function Header({ 
  routerId, 
  setRouterId, 
  onToggleSidebar, 
  darkMode, 
  onToggleDarkMode 
}: HeaderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected, connect, disconnect } = useMikrotik(routerId);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Query to get router connections
  const { data: connections } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => mikrotikApi.getConnections(),
  });

  // Form schema for connection modal
  const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    port: z.coerce.number().int().min(1).max(65535),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    isDefault: z.boolean().default(false),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
      port: 8728,
      username: "admin",
      password: "",
      isDefault: false,
    },
  });

  // Mutation to create new connection
  const createConnectionMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => mikrotikApi.createConnection(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setShowConnectionModal(false);
      setRouterId(data.id);
      form.reset();
      toast({
        title: "Connection Added",
        description: `${data.name} has been added to your connections`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add Connection",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Mutation to logout
  const logoutMutation = useMutation({
    mutationFn: () => mikrotikApi.logout(),
    onSuccess: () => {
      window.location.href = "/login";
    },
    onError: (error) => {
      toast({
        title: "Logout Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createConnectionMutation.mutate(data);
  };

  // Connection status indicator
  const statusInfo = getConnectionStatusInfo(isConnected);

  return (
    <header className="bg-white dark:bg-neutral-800 shadow-md z-10">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleSidebar}
            className="md:hidden"
          >
            <span className="material-icons">menu</span>
          </Button>
          <div className="flex items-center">
            <img 
              src="https://avatars.githubusercontent.com/u/4476612" 
              alt="MikroTik Logo" 
              className="h-8 w-8 mr-3" 
            />
            <h1 className="text-xl font-medium">MikroTik RouterOS Manager</h1>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Device Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mr-2">
                {connections?.find(c => c.id === routerId)?.name || "Select Router"}
                <span className="material-icons ml-2 text-sm">expand_more</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>RouterOS Devices</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {connections?.map(connection => (
                <DropdownMenuItem 
                  key={connection.id}
                  onClick={() => setRouterId(connection.id)}
                  className={routerId === connection.id ? "bg-primary/10" : ""}
                >
                  <span className="material-icons mr-2 text-sm">router</span>
                  {connection.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowConnectionModal(true)}>
                <span className="material-icons mr-2 text-sm">add_circle</span>
                Add New Connection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Device status indicator */}
          {routerId && (
            <div className={`flex items-center mr-3 ${statusInfo.bgColor} px-3 py-1 rounded-full`}>
              <span className={`w-2 h-2 ${statusInfo.pulseClass} rounded-full mr-2`}></span>
              <span className={`text-sm ${statusInfo.color} font-medium`}>{statusInfo.text}</span>
            </div>
          )}
          
          {/* Connection button */}
          {routerId && (
            <Button 
              variant={isConnected ? "destructive" : "default"}
              size="sm"
              onClick={isConnected ? disconnect : connect}
              className="mr-2"
            >
              <span className="material-icons mr-1 text-sm">
                {isConnected ? "link_off" : "link"}
              </span>
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          )}
          
          {/* Dark mode toggle */}
          <Button variant="ghost" size="icon" onClick={onToggleDarkMode}>
            <span className={`material-icons ${darkMode ? "hidden" : "block"}`}>dark_mode</span>
            <span className={`material-icons ${darkMode ? "block" : "hidden"}`}>light_mode</span>
          </Button>
          
          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-1">
                <span className="material-icons">account_circle</span>
                <span className="hidden sm:inline-block font-medium">Admin</span>
                <span className="material-icons text-sm">arrow_drop_down</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span className="material-icons mr-2 text-sm">person</span>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span className="material-icons mr-2 text-sm">settings</span>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                <span className="material-icons mr-2 text-sm">logout</span>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* New Connection Modal */}
      <Dialog open={showConnectionModal} onOpenChange={setShowConnectionModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Connection</DialogTitle>
            <DialogDescription>
              Enter the details to connect to your MikroTik router.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My RouterBoard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Router Address</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Port</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormDescription>Default API port is 8728</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Set as Default</FormLabel>
                      <FormDescription>
                        Use this connection automatically
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowConnectionModal(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createConnectionMutation.isPending}>
                  {createConnectionMutation.isPending ? "Adding..." : "Add Connection"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
