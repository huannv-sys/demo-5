import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { formatBytes } from "@/lib/utils";

interface BandwidthChartProps {
  routerId: number | null;
  isConnected: boolean;
}

export function BandwidthChart({ routerId, isConnected }: BandwidthChartProps) {
  const [selectedInterface, setSelectedInterface] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("1h");
  
  // Query for bandwidth data
  const { data: bandwidthData, isLoading, refetch } = useQuery({
    queryKey: ['/api/bandwidth', routerId, selectedInterface, timeRange],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getBandwidthData(routerId, selectedInterface === "all" ? undefined : selectedInterface, timeRange);
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Query for interfaces to populate filter
  const { data: interfaces } = useQuery({
    queryKey: ['/api/routers/interfaces', routerId],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getInterfaces(routerId);
    },
    enabled: !!routerId && isConnected
  });

  // Format the data for the chart
  const chartData = bandwidthData ? bandwidthData.download.map((item, index) => {
    const uploadValue = bandwidthData.upload[index]?.value || 0;
    const time = new Date(item.time);
    return {
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      download: item.value,
      upload: uploadValue
    };
  }) : [];

  // Time range options
  const timeRangeOptions = [
    { label: "Last 1 hour", value: "1h" },
    { label: "Last 24 hours", value: "24h" },
    { label: "Last 7 days", value: "7d" }
  ];

  return (
    <Card className="bg-white dark:bg-neutral-800 shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Bandwidth Usage</h2>
          <div className="flex space-x-2">
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="sm"
              className="flex items-center"
            >
              <span className="material-icons mr-1 text-sm">refresh</span>
              <span>Refresh</span>
            </Button>
            <select 
              className="bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded shadow-sm px-3 py-1 border border-gray-300 dark:border-neutral-700 text-sm"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex space-x-2 mb-4">
          <Button 
            onClick={() => setSelectedInterface("all")}
            variant={selectedInterface === "all" ? "default" : "ghost"}
            size="sm"
          >
            All
          </Button>
          {interfaces?.map(iface => (
            <Button
              key={iface.name}
              onClick={() => setSelectedInterface(iface.name)}
              variant={selectedInterface === iface.name ? "default" : "ghost"}
              size="sm"
            >
              {iface.name}
            </Button>
          ))}
        </div>
        
        <div className="h-64">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(value) => `${value} Mbps`} />
                <Tooltip 
                  formatter={(value) => [`${value} Mbps`, undefined]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="download" 
                  stroke="hsl(var(--chart-1))" 
                  activeDot={{ r: 8 }} 
                  strokeWidth={2}
                  name="Download"
                />
                <Line 
                  type="monotone" 
                  dataKey="upload" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Upload"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-neutral-500 dark:text-neutral-400">
                {routerId && isConnected
                  ? "No bandwidth data available"
                  : "Connect to a router to view bandwidth data"}
              </p>
            </div>
          )}
        </div>
        
        {/* Traffic Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Download</div>
            <div className="text-lg font-medium text-primary-light">
              {bandwidthData?.download.length 
                ? `${bandwidthData.download[bandwidthData.download.length - 1].value.toFixed(1)} Mbps` 
                : "0 Mbps"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Upload</div>
            <div className="text-lg font-medium text-secondary-light">
              {bandwidthData?.upload.length 
                ? `${bandwidthData.upload[bandwidthData.upload.length - 1].value.toFixed(1)} Mbps` 
                : "0 Mbps"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Daily Download</div>
            <div className="text-lg font-medium">5.8 GB</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Daily Upload</div>
            <div className="text-lg font-medium">1.2 GB</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
