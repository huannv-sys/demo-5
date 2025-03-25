import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mikrotikApi } from "@/lib/mikrotik-api";
import { useAppContext } from "@/hooks/use-app-context";
import { getLogLevelInfo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Logs() {
  const { selectedRouterId, connected } = useAppContext();
  const [topic, setTopic] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Query for logs data
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['/api/routers/logs', selectedRouterId],
    queryFn: async () => {
      if (!selectedRouterId || !connected) return null;
      return mikrotikApi.getLogs(selectedRouterId, 500); // Get more logs for the logs page
    },
    enabled: !!selectedRouterId && connected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Filter logs by topic, level, and search query
  const filteredLogs = logs?.filter(log => {
    const topicMatch = topic === "all" || log.topics.includes(topic);
    const levelMatch = level === "all" || log.level === level;
    const searchMatch = searchQuery === "" || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.topics.toLowerCase().includes(searchQuery.toLowerCase());
    
    return topicMatch && levelMatch && searchMatch;
  });

  // Extract unique topics for the filter dropdown
  const uniqueTopics = logs 
    ? Array.from(new Set(logs.flatMap(log => log.topics.split(',')))) 
    : [];
  
  // Extract unique levels for the filter dropdown
  const uniqueLevels = logs 
    ? Array.from(new Set(logs.map(log => log.level))) 
    : [];

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-medium">System Logs</h1>
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
          <CardTitle>Log Entries</CardTitle>
          <CardDescription>
            View and filter system logs from your MikroTik router
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {uniqueTopics.map(topic => (
                    <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {uniqueLevels.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !selectedRouterId || !connected ? (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              Connect to a router to view logs
            </div>
          ) : filteredLogs?.length ? (
            <ScrollArea className="h-[calc(100vh-300px)] log-container rounded border border-gray-200 dark:border-neutral-700">
              <div className="font-mono text-xs space-y-2 p-4">
                {filteredLogs.map((log) => {
                  const levelInfo = getLogLevelInfo(log.level);
                  
                  return (
                    <div key={log.id} className="mb-2">
                      <span className="text-neutral-400 dark:text-neutral-500">{log.time}</span>
                      <span className={`ml-2 px-1.5 py-0.5 ${levelInfo.bgColor} ${levelInfo.textColor} rounded`}>
                        {levelInfo.label}
                      </span>
                      <span className="ml-2 text-neutral-500 dark:text-neutral-400">[{log.topics}]</span>
                      <span className="ml-2">{log.message}</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              No logs matching your filters
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Showing {filteredLogs?.length || 0} of {logs?.length || 0} log entries
            </p>
            <Button variant="outline">
              <span className="material-icons mr-2 text-sm">download</span>
              Export Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
