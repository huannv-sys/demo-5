import { useState } from "react";
import { useRouter } from "@/contexts/router-context";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { insertRouterConnectionSchema } from "@shared/schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Router, Loader2 } from "lucide-react";

// Extend the schema with some additional validations
const routerFormSchema = insertRouterConnectionSchema
  .extend({
    port: z.coerce.number().int().min(1).max(65535),
  })
  .refine((data: any) => data.address.trim() !== "", {
    message: "Address cannot be empty",
    path: ["address"],
  });

type RouterFormValues = z.infer<typeof routerFormSchema>;

export default function Connect() {
  const { availableRouters, connect, isConnected, isLoadingRouters, refreshRouters } = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  // Set up form with defaults
  const form = useForm<RouterFormValues>({
    resolver: zodResolver(routerFormSchema),
    defaultValues: {
      name: "",
      address: "",
      port: 8728,
      username: "admin",
      password: "",
      isDefault: false,
    },
  });

  async function onSubmit(data: RouterFormValues) {
    setIsLoading(true);
    try {
      console.log("Submitting router data:", data);
      // Save the router configuration
      const response = await apiRequest("POST", "/api/connections", data);
      const router = await response.json();
      console.log("Router created:", router);
      
      // Connect to the router
      await connect(router.id);
      
      // Navigate to dashboard on success
      navigate("/");
      
      toast({
        title: "Router added and connected successfully",
        description: `Connected to ${data.name} at ${data.address}`,
      });
    } catch (error) {
      console.error("Failed to add router:", error);
      toast({
        title: "Failed to add router",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      refreshRouters(); // Refresh the router list
    }
  }

  return (
    <div className="container mx-auto p-6 overflow-auto">
      <div className="flex flex-col items-center py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Router className="h-6 w-6" />
              Connect to MikroTik Router
            </CardTitle>
            <CardDescription>
              Enter the connection details for your RouterOS device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Router Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Office Router" {...field} />
                      </FormControl>
                      <FormDescription>
                        A friendly name to identify this router
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host</FormLabel>
                      <FormControl>
                        <Input placeholder="192.168.1.1" {...field} />
                      </FormControl>
                      <FormDescription>
                        IP address or hostname of the router
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="8728"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Default API port is 8728 (or 8729 for SSL)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
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
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Set as Default Connection
                        </FormLabel>
                        <FormDescription>
                          Automatically connect to this router on startup
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          {availableRouters && availableRouters.length > 0 && (
            <CardFooter className="flex flex-col">
              <div className="text-sm font-medium mb-2">Saved Routers:</div>
              <div className="w-full space-y-2">
                {availableRouters.map((router) => (
                  <Button
                    key={router.id}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => connect(router.id)}
                    disabled={isLoading}
                  >
                    <span>{router.name}</span>
                    <span className="text-xs text-gray-500">
                      {router.address}:{router.port}
                    </span>
                  </Button>
                ))}
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
