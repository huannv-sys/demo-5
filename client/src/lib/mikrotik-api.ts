import { apiRequest } from './queryClient';
import {
  ResourceInfo,
  Interface,
  Wireless,
  WirelessClient,
  FirewallRule,
  RoutingRule,
  ArpEntry,
  Log,
  RouterUser,
  DhcpLease,
  BandwidthData,
  RouterConnection
} from '@shared/schema';

// Constants
const API_ENDPOINT = '/api';

// Types for API responses
type ConnectionStatusResponse = {
  connected: boolean;
  lastConnected?: string;
};

// MikroTik API client
export const mikrotikApi = {
  // Authentication
  async login(username: string, password: string): Promise<{ id: number; username: string }> {
    const res = await apiRequest('POST', `${API_ENDPOINT}/auth/login`, { username, password });
    return res.json();
  },

  async logout(): Promise<void> {
    await apiRequest('POST', `${API_ENDPOINT}/auth/logout`);
  },

  async checkAuthStatus(): Promise<{ authenticated: boolean }> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/auth/status`);
    return res.json();
  },

  // Router connections
  async getConnections(): Promise<Omit<RouterConnection, 'password'>[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections`);
    return res.json();
  },

  async createConnection(connection: {
    name: string;
    address: string;
    port: number;
    username: string;
    password: string;
    isDefault?: boolean;
  }): Promise<Omit<RouterConnection, 'password'>> {
    const res = await apiRequest('POST', `${API_ENDPOINT}/connections`, connection);
    return res.json();
  },

  async updateConnection(
    id: number,
    connection: Partial<{
      name: string;
      address: string;
      port: number;
      username: string;
      password: string;
      isDefault: boolean;
    }>
  ): Promise<Omit<RouterConnection, 'password'>> {
    const res = await apiRequest('PUT', `${API_ENDPOINT}/connections/${id}`, connection);
    return res.json();
  },

  async deleteConnection(id: number): Promise<{ message: string }> {
    const res = await apiRequest('DELETE', `${API_ENDPOINT}/connections/${id}`);
    return res.json();
  },

  async connectToRouter(id: number): Promise<{ message: string }> {
    const res = await apiRequest('POST', `${API_ENDPOINT}/connections/${id}/connect`);
    return res.json();
  },

  async disconnectFromRouter(id: number): Promise<{ message: string }> {
    const res = await apiRequest('POST', `${API_ENDPOINT}/connections/${id}/disconnect`);
    return res.json();
  },

  async getConnectionStatus(id: number): Promise<ConnectionStatusResponse> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${id}/status`);
    return res.json();
  },

  // Router resources
  async getResourceInfo(routerId: number): Promise<ResourceInfo> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/resources`);
    return res.json();
  },

  // Interfaces
  async getInterfaces(routerId: number): Promise<Interface[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/interfaces`);
    return res.json();
  },

  // Wireless
  async getWirelessNetworks(routerId: number): Promise<Wireless[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/wireless`);
    return res.json();
  },

  async getWirelessClients(routerId: number): Promise<WirelessClient[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/wireless/clients`);
    return res.json();
  },

  // Firewall
  async getFirewallRules(routerId: number, chain?: string): Promise<FirewallRule[]> {
    const url = chain
      ? `${API_ENDPOINT}/connections/${routerId}/firewall?chain=${chain}`
      : `${API_ENDPOINT}/connections/${routerId}/firewall`;
    const res = await apiRequest('GET', url);
    return res.json();
  },

  // Routing
  async getRoutingRules(routerId: number): Promise<RoutingRule[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/routing`);
    return res.json();
  },

  // ARP
  async getArpEntries(routerId: number): Promise<ArpEntry[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/arp`);
    return res.json();
  },

  // Logs
  async getLogs(routerId: number, limit?: number): Promise<Log[]> {
    const url = limit
      ? `${API_ENDPOINT}/connections/${routerId}/logs?limit=${limit}`
      : `${API_ENDPOINT}/connections/${routerId}/logs`;
    const res = await apiRequest('GET', url);
    return res.json();
  },

  // Users
  async getUsers(routerId: number): Promise<RouterUser[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/users`);
    return res.json();
  },

  // DHCP
  async getDhcpLeases(routerId: number): Promise<DhcpLease[]> {
    const res = await apiRequest('GET', `${API_ENDPOINT}/connections/${routerId}/dhcp/leases`);
    return res.json();
  },

  // Execute command
  async executeCommand(routerId: number, command: string): Promise<any> {
    const res = await apiRequest('POST', `${API_ENDPOINT}/connections/${routerId}/command`, { command });
    return res.json();
  },

  // Bandwidth data for chart
  async getBandwidthData(routerId: number, interface_name?: string, timeframe = '1h'): Promise<BandwidthData> {
    try {
      const url = interface_name
        ? `${API_ENDPOINT}/connections/${routerId}/bandwidth?interface=${interface_name}&timeframe=${timeframe}`
        : `${API_ENDPOINT}/connections/${routerId}/bandwidth?timeframe=${timeframe}`;
      
      const res = await apiRequest('GET', url);
      return res.json();
    } catch (error) {
      console.error('Error fetching bandwidth data:', error);
      
      // Return an error object instead of mock data
      throw new Error(`Failed to fetch bandwidth data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};
