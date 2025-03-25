import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { useAppContext } from "@/hooks/use-app-context";
import { formatDate } from "@/lib/utils";
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
import { RouterUser } from "@shared/schema";

export default function Users() {
  const { selectedRouterId, connected } = useAppContext();
  const [selectedUser, setSelectedUser] = useState<RouterUser | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  
  // Query for users data
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['/api/routers/users', selectedRouterId],
    queryFn: async () => {
      if (!selectedRouterId || !connected) return null;
      return mikrotikApi.getUsers(selectedRouterId);
    },
    enabled: !!selectedRouterId && connected,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const showUserDetailsDialog = (user: RouterUser) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-medium">Users</h1>
        <Button
          variant="outline"
          onClick={() => refetch()}
          className="flex items-center"
        >
          <span className="material-icons mr-1 text-sm">refresh</span>
          <span>Refresh</span>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Router Users</CardTitle>
          <CardDescription>
            Manage users on your MikroTik router
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !selectedRouterId || !connected ? (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              Connect to a router to view users
            </div>
          ) : users?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-neutral-850">
                    <TableHead>Username</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.group}</TableCell>
                      <TableCell>{user.lastLogin ? formatDate(user.lastLogin) : "Never"}</TableCell>
                      <TableCell>
                        <span className="flex items-center">
                          <span className={`w-2 h-2 ${user.disabled ? 'bg-red-500' : 'bg-green-500'} rounded-full mr-2`}></span>
                          <span>{user.disabled ? "Disabled" : "Enabled"}</span>
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
                            <DropdownMenuItem onClick={() => showUserDetailsDialog(user)}>
                              <span className="material-icons mr-2 text-sm">info</span>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <span className="material-icons mr-2 text-sm">edit</span>
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <span className="material-icons mr-2 text-sm">key</span>
                              Change Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className={user.disabled ? "text-green-600" : "text-red-600"}
                            >
                              <span className="material-icons mr-2 text-sm">
                                {user.disabled ? "check_circle" : "block"}
                              </span>
                              {user.disabled ? "Enable User" : "Disable User"}
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
              No users found
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button>
            <span className="material-icons mr-2 text-sm">person_add</span>
            Add New User
          </Button>
        </CardFooter>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>User: {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Detailed information about this user.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Username</p>
                  <p className="font-medium">{selectedUser.name}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Group</p>
                  <p className="font-medium">{selectedUser.group}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Status</p>
                  <p className="font-medium flex items-center">
                    <span className={`w-2 h-2 ${selectedUser.disabled ? 'bg-red-500' : 'bg-green-500'} rounded-full mr-2`}></span>
                    {selectedUser.disabled ? "Disabled" : "Enabled"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Last Login</p>
                  <p className="font-medium">{selectedUser.lastLogin ? formatDate(selectedUser.lastLogin) : "Never"}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setShowUserDetails(false)}
            >
              Close
            </Button>
            <Button
              variant="default"
            >
              <span className="material-icons mr-1 text-sm">edit</span>
              Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
