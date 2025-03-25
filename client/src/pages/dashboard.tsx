import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { useAppContext } from "@/hooks/use-app-context";
import { formatBytes, formatUptime, formatDate } from "@/lib/utils";
import { ResourceCard } from "@/components/dashboard/resource-card";
import { BandwidthChart } from "@/components/dashboard/bandwidth-chart";
import { InterfacesTable } from "@/components/dashboard/interfaces-table";
import { LogsViewer } from "@/components/dashboard/logs-viewer";
import { FirewallSummary } from "@/components/dashboard/firewall-summary";
import { WirelessNetworks } from "@/components/dashboard/wireless-networks";

export default function Dashboard() {
  const { selectedRouterId, connected } = useAppContext();

  // Fetch resource information
  const { data: resourceInfo, isLoading: resourceLoading } = useQuery({
    queryKey: ['/api/routers/resources', selectedRouterId],
    queryFn: async () => {
      if (!selectedRouterId || !connected) return null;
      return mikrotikApi.getResourceInfo(selectedRouterId);
    },
    enabled: !!selectedRouterId && connected,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Calculate memory usage
  const memoryUsage = resourceInfo ? {
    used: resourceInfo.totalMemory - resourceInfo.freeMemory,
    total: resourceInfo.totalMemory,
    percent: Math.round(((resourceInfo.totalMemory - resourceInfo.freeMemory) / resourceInfo.totalMemory) * 100)
  } : null;

  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-medium">Dashboard</h1>
        <div className="flex space-x-2">
          <button className="flex items-center px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-700">
            <span className="material-icons mr-1 text-sm">refresh</span>
            <span>Refresh</span>
          </button>
          <select className="bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded shadow-sm px-3 py-2 border border-gray-300 dark:border-neutral-700">
            <option>Last 1 hour</option>
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
          </select>
        </div>
      </div>

      {/* System Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* CPU Card */}
        <ResourceCard
          title="CPU Usage"
          value={resourceInfo ? `${resourceInfo.cpuLoad}%` : "—"}
          icon="memory"
          iconColor="text-primary-light"
          change={{
            value: "4%",
            increase: false
          }}
          progress={{
            value: resourceInfo?.cpuLoad || 0,
            color: "bg-primary-light"
          }}
        />

        {/* Memory Card */}
        <ResourceCard
          title="Memory Usage"
          value={memoryUsage ? `${formatBytes(memoryUsage.used)} / ${formatBytes(memoryUsage.total)}` : "—"}
          icon="sd_storage"
          iconColor="text-secondary-light"
          change={{
            value: "12%",
            increase: true
          }}
          progress={{
            value: memoryUsage?.percent || 0,
            color: "bg-secondary-light"
          }}
        />

        {/* Uptime Card */}
        <ResourceCard
          title="System Uptime"
          value={resourceInfo ? formatUptime(resourceInfo.uptime) : "—"}
          icon="schedule"
          iconColor="text-warning-light"
          footer={
            <>Last reboot: {resourceInfo ? formatDate(new Date(Date.now() - (parseFloat(resourceInfo.uptime) * 1000))) : "Unknown"}</>
          }
        />

        {/* Version Card */}
        <ResourceCard
          title="System Version"
          value={resourceInfo ? resourceInfo.version : "—"}
          icon="system_update"
          iconColor="text-primary-light"
          footer={
            <div className="text-green-500 flex items-center">
              <span className="material-icons text-sm mr-1">check_circle</span>
              <span>Up to date</span>
            </div>
          }
        />
      </div>

      {/* Bandwidth Usage Graph */}
      <div className="mb-6">
        <BandwidthChart
          routerId={selectedRouterId}
          isConnected={connected}
        />
      </div>

      {/* Two-column layout for bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Network Interfaces */}
        <InterfacesTable 
          routerId={selectedRouterId}
          isConnected={connected}
        />

        {/* System Logs Preview */}
        <LogsViewer 
          routerId={selectedRouterId}
          isConnected={connected}
        />
      </div>

      {/* Two-column layout for bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Firewall Rules Summary */}
        <FirewallSummary 
          routerId={selectedRouterId}
          isConnected={connected}
        />

        {/* Wireless Networks */}
        <WirelessNetworks 
          routerId={selectedRouterId}
          isConnected={connected}
        />
      </div>
    </div>
  );
}
