import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { formatUptime } from "@/lib/utils";

type SidebarProps = {
  routerId: number | null;
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ routerId, collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { connected } = useConnectionStatus(routerId);
  
  // Fetch resource info for uptime and version
  const { data: resourceInfo } = useQuery({
    queryKey: ['/api/routers/resources', routerId],
    queryFn: async () => {
      if (!routerId || !connected) return null;
      return mikrotikApi.getResourceInfo(routerId);
    },
    enabled: !!routerId && connected,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Fetch router connection details
  const { data: connections } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => mikrotikApi.getConnections(),
  });
  
  const currentRouter = connections?.find(conn => conn.id === routerId);
  
  const sidebarItems = [
    // Main section
    { id: 'dashboard', label: 'Dashboard', path: '/', icon: 'dashboard' },
    { id: 'interfaces', label: 'Interfaces', path: '/interfaces', icon: 'device_hub' },
    { id: 'wireless', label: 'Wireless', path: '/wireless', icon: 'wifi' },
    { id: 'firewall', label: 'Firewall', path: '/firewall', icon: 'security' },
    { id: 'nat', label: 'NAT', path: '/nat', icon: 'swap_horiz' },
    { id: 'routing', label: 'Routing', path: '/routing', icon: 'alt_route' },
    { id: 'arp', label: 'ARP', path: '/arp', icon: 'radar' },
    { id: 'logs', label: 'System Logs', path: '/logs', icon: 'article' },
    { id: 'users', label: 'Users', path: '/users', icon: 'people' },
    
    // Services section
    { id: 'dhcp', label: 'DHCP Server', path: '/dhcp', icon: 'dns', section: 'Services' },
    { id: 'dns', label: 'DNS', path: '/dns', icon: 'public', section: 'Services' },
    { id: 'snmp', label: 'SNMP', path: '/snmp', icon: 'settings_remote', section: 'Services' },
    { id: 'ntp', label: 'NTP', path: '/ntp', icon: 'schedule', section: 'Services' },
    
    // System section
    { id: 'backup', label: 'Backup & Restore', path: '/backup', icon: 'backup', section: 'System' },
    { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings', section: 'System' },
  ];

  // Group items by section
  const groupedItems: Record<string, typeof sidebarItems> = {};
  sidebarItems.forEach(item => {
    const section = item.section || 'Main'; // Default to 'Main' if no section specified
    if (!groupedItems[section]) {
      groupedItems[section] = [];
    }
    groupedItems[section].push(item);
  });

  return (
    <aside 
      className={cn(
        "bg-white dark:bg-neutral-800 shadow-md flex-shrink-0 transition-all duration-300 ease-in-out h-screen",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Connection Status */}
      <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
        <h2 className={cn(
          "text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2",
          collapsed && "text-center"
        )}>
          {collapsed ? "DEVICE" : "DEVICE CONNECTION"}
        </h2>
        <div className={cn(
          "flex items-center justify-between mb-3",
          collapsed && "flex-col gap-2"
        )}>
          <div className={collapsed ? "text-center" : ""}>
            <p className="font-medium text-sm truncate">{currentRouter?.name || "No Router"}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {currentRouter ? `${currentRouter.address}:${currentRouter.port}` : "Not Connected"}
            </p>
          </div>
          <span className={cn(
            "material-icons",
            connected ? "text-green-500" : "text-red-500"
          )}>
            {connected ? "check_circle" : "error"}
          </span>
        </div>
        {!collapsed && (
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">
              {resourceInfo?.version || "Unknown Version"}
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">
              {resourceInfo ? `Uptime: ${resourceInfo.uptime}` : ""}
            </span>
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <ScrollArea className="h-[calc(100vh-110px)]">
        <nav className="p-1">
          {Object.entries(groupedItems).map(([section, items]) => (
            <div key={section} className="mt-2">
              {section !== 'Main' && !collapsed && (
                <div className="mt-2 px-3 py-2">
                  <h2 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                    {section}
                  </h2>
                </div>
              )}
              
              {items.map(item => (
                <Link 
                  key={item.id} 
                  href={item.path}
                >
                  <a className={cn(
                    "sidebar-item flex items-center px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 my-1",
                    location === item.path 
                      ? "active bg-gray-50 dark:bg-neutral-800 text-neutral-900 dark:text-gray-100" 
                      : "text-neutral-600 dark:text-gray-300",
                    collapsed && "justify-center"
                  )}>
                    <span className={cn("material-icons", collapsed ? "" : "mr-3")}>
                      {item.icon}
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </a>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>
      
      {/* Collapse/Expand button */}
      <div className="border-t border-gray-200 dark:border-neutral-700 p-2 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full flex items-center justify-center"
        >
          <span className="material-icons">
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
