import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { Link } from "wouter";
import { getLogLevelInfo } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LogsViewerProps {
  routerId: number | null;
  isConnected: boolean;
}

export function LogsViewer({ routerId, isConnected }: LogsViewerProps) {
  const [topic, setTopic] = useState<string>("all");
  
  // Query for logs data
  const { data: logs, isLoading } = useQuery({
    queryKey: ['/api/routers/logs', routerId, topic],
    queryFn: async () => {
      if (!routerId || !isConnected) return null;
      return mikrotikApi.getLogs(routerId, 100);
    },
    enabled: !!routerId && isConnected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Filter logs by topic if needed
  const filteredLogs = topic === "all" 
    ? logs 
    : logs?.filter(log => log.topics.includes(topic));

  // Extract unique topics for the filter dropdown
  const uniqueTopics = logs 
    ? Array.from(new Set(logs.flatMap(log => log.topics.split(',')))) 
    : [];

  return (
    <Card>
      <div className="border-b border-gray-200 dark:border-neutral-700 px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-medium">Recent System Logs</h2>
        <div className="flex items-center">
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="w-[140px] h-8 text-sm mr-2">
              <SelectValue placeholder="All Topics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              {uniqueTopics.map(topic => (
                <SelectItem key={topic} value={topic}>{topic}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="text-primary-light hover:text-primary-dark dark:hover:text-primary">
            <span className="material-icons">filter_list</span>
          </Button>
        </div>
      </div>
      <ScrollArea className="h-80 log-container">
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !routerId || !isConnected ? (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              Connect to a router to view logs
            </div>
          ) : filteredLogs?.length ? (
            <div className="font-mono text-xs space-y-2">
              {filteredLogs.map((log) => {
                const levelInfo = getLogLevelInfo(log.level);
                
                return (
                  <div key={log.id} className="mb-2">
                    <span className="text-neutral-400 dark:text-neutral-500">{log.time}</span>
                    <span className={`ml-2 px-1.5 py-0.5 ${levelInfo.bgColor} ${levelInfo.textColor} rounded`}>
                      {levelInfo.label}
                    </span>
                    <span className="ml-2">{log.message}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              No logs available
            </div>
          )}
        </CardContent>
      </ScrollArea>
      <CardFooter className="border-t border-gray-200 dark:border-neutral-700 px-4 py-3 text-right">
        <Link href="/logs">
          <Button variant="link" size="sm" className="text-primary-light hover:text-primary-dark dark:hover:text-primary text-sm font-medium">
            View All Logs
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
