import { apiRequest } from '@/lib/queryClient';
import {
  SystemResource,
  NetworkInterface,
  WirelessNetwork,
  WirelessClient,
  FirewallRule,
  NatRule,
  Route,
  DhcpLease,
  RouterOsUser,
  LogEntry,
  Router,
  InsertRouter
} from '@shared/schema';

// Router management
export async function fetchRouters(): Promise<Router[]> {
  const response = await apiRequest('GET', '/api/routers');
  return response.json();
}

export async function fetchDefaultRouter(): Promise<Router> {
  const response = await apiRequest('GET', '/api/routers/default');
  return response.json();
}

export async function createRouter(router: InsertRouter): Promise<Router> {
  const response = await apiRequest('POST', '/api/routers', router);
  return response.json();
}

export async function updateRouter(id: number, router: Partial<InsertRouter>): Promise<Router> {
  const response = await apiRequest('PUT', `/api/routers/${id}`, router);
  return response.json();
}

export async function deleteRouter(id: number): Promise<void> {
  await apiRequest('DELETE', `/api/routers/${id}`);
}

export async function setDefaultRouter(id: number): Promise<Router> {
  const response = await apiRequest('POST', `/api/routers/${id}/default`);
  return response.json();
}

// Connection management
export async function connectToRouter(id: number): Promise<{ status: string; routerId: number }> {
  const response = await apiRequest('POST', `/api/connect/${id}`);
  return response.json();
}

export async function disconnectFromRouter(id: number): Promise<{ status: string; routerId: number }> {
  const response = await apiRequest('POST', `/api/disconnect/${id}`);
  return response.json();
}

export async function getConnectionStatus(id: number): Promise<{ connected: boolean; routerId: number }> {
  const response = await apiRequest('GET', `/api/status/${id}`);
  return response.json();
}

// RouterOS data fetching
export async function fetchSystemResources(id: number): Promise<SystemResource> {
  const response = await apiRequest('GET', `/api/system-resources/${id}`);
  return response.json();
}

export async function fetchInterfaces(id: number): Promise<NetworkInterface[]> {
  const response = await apiRequest('GET', `/api/interfaces/${id}`);
  return response.json();
}

export async function fetchWirelessNetworks(id: number): Promise<WirelessNetwork[]> {
  const response = await apiRequest('GET', `/api/wireless/${id}`);
  return response.json();
}

export async function fetchWirelessClients(id: number): Promise<WirelessClient[]> {
  const response = await apiRequest('GET', `/api/wireless-clients/${id}`);
  return response.json();
}

export async function fetchFirewallRules(id: number): Promise<FirewallRule[]> {
  const response = await apiRequest('GET', `/api/firewall/${id}`);
  return response.json();
}

export async function fetchNatRules(id: number): Promise<NatRule[]> {
  const response = await apiRequest('GET', `/api/nat/${id}`);
  return response.json();
}

export async function fetchRoutes(id: number): Promise<Route[]> {
  const response = await apiRequest('GET', `/api/routes/${id}`);
  return response.json();
}

export async function fetchDhcpLeases(id: number): Promise<DhcpLease[]> {
  const response = await apiRequest('GET', `/api/dhcp-leases/${id}`);
  return response.json();
}

export async function fetchRouterUsers(id: number): Promise<RouterOsUser[]> {
  const response = await apiRequest('GET', `/api/router-users/${id}`);
  return response.json();
}

export async function fetchLogs(id: number, limit = 50): Promise<LogEntry[]> {
  const response = await apiRequest('GET', `/api/logs/${id}?limit=${limit}`);
  return response.json();
}

// Utility functions to format data
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
