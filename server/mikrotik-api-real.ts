import { RouterOSClient } from 'routeros-client';
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
  DhcpLease
} from '@shared/schema';
import { MikroTikAPI } from './mikrotik-api';

export class RealMikroTikAPI implements MikroTikAPI {
  private connected: boolean = false;
  private connectionInfo: { address: string; port: number; username: string; password: string } | null = null;
  private client: any = null;

  async connect(address: string, port: number, username: string, password: string): Promise<boolean> {
    try {
      console.log(`Connecting to real device at ${address}:${port} with username: ${username}`);
      
      // Validate connection parameters
      if (!address || !username || !password) {
        throw new Error("Missing required connection parameters");
      }
      
      // Create a new RouterOS API client
      this.client = new RouterOSClient({
        host: address,
        port: port,
        user: username,
        password: password,
        timeout: 5000 // 5 seconds timeout
      });
      
      // Connect to the device
      await this.client.connect();
      
      // Store connection info
      this.connectionInfo = { address, port, username, password };
      this.connected = true;
      
      console.log(`Successfully connected to real device at ${address}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to connect to real device at ${address}:${port} - ${errorMessage}`);
      this.connected = false;
      this.client = null;
      throw new Error(`Connection to real device failed: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
    } catch (error) {
      console.error("Error disconnecting from RouterOS device:", error);
    } finally {
      this.connected = false;
      this.connectionInfo = null;
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  async getResourceInfo(): Promise<ResourceInfo> {
    this.checkConnection();
    try {
      // Query real system resources
      const [resourceData] = await this.client!.api().write('/system/resource/print');
      
      return {
        cpuLoad: parseInt(resourceData['cpu-load'] || '0', 10),
        cpuCount: parseInt(resourceData['cpu-count'] || '1', 10),
        uptime: resourceData.uptime || '0s',
        version: resourceData.version || 'Unknown',
        freeMemory: parseInt(resourceData['free-memory'] || '0', 10),
        totalMemory: parseInt(resourceData['total-memory'] || '0', 10),
        freeHdd: parseInt(resourceData['free-hdd-space'] || '0', 10),
        totalHdd: parseInt(resourceData['total-hdd-space'] || '0', 10),
        boardName: resourceData['board-name'] || 'Unknown',
        architecture: resourceData.architecture || 'Unknown',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting resource info: ${errorMessage}`);
      throw new Error(`Failed to get resource info: ${errorMessage}`);
    }
  }

  async getInterfaces(): Promise<Interface[]> {
    this.checkConnection();
    try {
      // Get interfaces
      const interfacesData = await this.client!.api().write('/interface/print');
      
      // Get IP addresses
      const addressesData = await this.client!.api().write('/ip/address/print');
      
      // Map interfaces with their addresses
      return interfacesData.map((iface: any) => {
        const addresses = addressesData
          .filter((addr: any) => addr.interface === iface.name)
          .map((addr: any) => ({
            address: addr.address,
            network: addr.network || '',
            interface: addr.interface,
          }));
        
        return {
          name: iface.name,
          type: iface.type || 'unknown',
          mtu: parseInt(iface.mtu || '0', 10),
          actualMtu: parseInt(iface['actual-mtu'] || '0', 10),
          l2mtu: parseInt(iface.l2mtu || '0', 10),
          macAddress: iface['mac-address'] || '',
          running: iface.running === 'true',
          disabled: iface.disabled === 'true',
          rxBytes: parseInt(iface['rx-byte'] || '0', 10),
          txBytes: parseInt(iface['tx-byte'] || '0', 10),
          rxPackets: parseInt(iface['rx-packet'] || '0', 10),
          txPackets: parseInt(iface['tx-packet'] || '0', 10),
          addresses,
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting interfaces: ${errorMessage}`);
      throw new Error(`Failed to get interfaces: ${errorMessage}`);
    }
  }

  async getWirelessNetworks(): Promise<Wireless[]> {
    this.checkConnection();
    try {
      // Get wireless interfaces
      const wirelessData = await this.client!.api().write('/interface/wireless/print');
      
      // Count clients for each interface
      const clientsData = await this.client!.api().write('/interface/wireless/registration-table/print');
      
      const clientCount = new Map<string, number>();
      clientsData.forEach((client: any) => {
        const iface = client.interface || '';
        clientCount.set(iface, (clientCount.get(iface) || 0) + 1);
      });
      
      return wirelessData.map((wireless: any, index: number) => ({
        id: wireless['.id'] || `${index + 1}`,
        interface: wireless.name,
        ssid: wireless.ssid || '',
        security: this.getWirelessSecurity(wireless),
        disabled: wireless.disabled === 'true',
        clients: clientCount.get(wireless.name) || 0,
        channel: wireless.channel || 'auto',
        band: wireless.band || '',
        frequency: parseInt(wireless.frequency || '0', 10),
        mode: wireless.mode || '',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting wireless networks: ${errorMessage}`);
      throw new Error(`Failed to get wireless networks: ${errorMessage}`);
    }
  }

  private getWirelessSecurity(wireless: any): string {
    if (wireless['security-profile']) {
      // In real implementation, you might need to fetch the security profile details
      return wireless['security-profile'];
    }
    
    if (wireless['wpa-psk'] || wireless['wpa2-psk']) {
      return 'WPA2-PSK';
    }
    
    if (wireless.security === 'none') {
      return 'none';
    }
    
    return wireless.security || 'Unknown';
  }

  async getWirelessClients(): Promise<WirelessClient[]> {
    this.checkConnection();
    try {
      const clientsData = await this.client!.api().write('/interface/wireless/registration-table/print');
      
      return clientsData.map((client: any, index: number) => ({
        id: client['.id'] || `${index + 1}`,
        interface: client.interface || '',
        macAddress: client['mac-address'] || '',
        lastActivity: parseInt(client['last-activity'] || '0', 10),
        signalStrength: parseInt(client['signal-strength'] || '0', 10),
        txRate: parseInt(client['tx-rate'] || '0', 10),
        rxRate: parseInt(client['rx-rate'] || '0', 10),
        uptime: client.uptime || '',
        name: client.comment || `Client ${index + 1}`,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting wireless clients: ${errorMessage}`);
      throw new Error(`Failed to get wireless clients: ${errorMessage}`);
    }
  }

  async getFirewallRules(chain?: string): Promise<FirewallRule[]> {
    this.checkConnection();
    try {
      // Get firewall filter rules
      let command = '/ip/firewall/filter/print';
      if (chain) {
        command += `=?chain=${chain}`;
      }
      
      const rulesData = await this.client!.api().write(command);
      
      return rulesData.map((rule: any, index: number) => {
        const ruleObj: FirewallRule = {
          id: rule['.id'] || `${index + 1}`,
          chain: rule.chain || '',
          action: rule.action || '',
          srcAddress: rule['src-address'] || '',
          dstAddress: rule['dst-address'] || '',
          protocol: rule.protocol || '',
          disabled: rule.disabled === 'true',
          comment: rule.comment || '',
          bytes: parseInt(rule.bytes || '0', 10),
          packets: parseInt(rule.packets || '0', 10),
        };
        
        if (rule['dst-port']) {
          ruleObj.dstPort = rule['dst-port'];
        }
        
        if (rule['src-port']) {
          ruleObj.srcPort = rule['src-port'];
        }
        
        return ruleObj;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting firewall rules: ${errorMessage}`);
      throw new Error(`Failed to get firewall rules: ${errorMessage}`);
    }
  }

  async getRoutingRules(): Promise<RoutingRule[]> {
    this.checkConnection();
    try {
      const routesData = await this.client!.api().write('/ip/route/print');
      
      return routesData.map((route: any, index: number) => ({
        id: route['.id'] || `${index + 1}`,
        dstAddress: route['dst-address'] || '',
        gateway: route.gateway || '',
        distance: parseInt(route.distance || '0', 10),
        static: route.static === 'true',
        disabled: route.disabled === 'true',
        active: route.active === 'true',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting routing rules: ${errorMessage}`);
      throw new Error(`Failed to get routing rules: ${errorMessage}`);
    }
  }

  async getArpEntries(): Promise<ArpEntry[]> {
    this.checkConnection();
    try {
      const arpData = await this.client!.api().write('/ip/arp/print');
      
      return arpData.map((entry: any, index: number) => ({
        id: entry['.id'] || `${index + 1}`,
        address: entry.address || '',
        macAddress: entry['mac-address'] || '',
        interface: entry.interface || '',
        dynamic: entry.dynamic === 'true',
        invalid: entry.invalid === 'true',
        complete: entry.complete === 'true',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting ARP entries: ${errorMessage}`);
      throw new Error(`Failed to get ARP entries: ${errorMessage}`);
    }
  }

  async getLogs(limit: number = 100): Promise<Log[]> {
    this.checkConnection();
    try {
      const command = `/log/print${limit ? `=count=${limit}` : ''}`;
      const logsData = await this.client!.api().write(command);
      
      return logsData.map((log: any, index: number) => ({
        id: `${index + 1}`,
        time: log.time || '',
        topics: log.topics || '',
        message: log.message || '',
        level: this.getLogLevel(log),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting logs: ${errorMessage}`);
      throw new Error(`Failed to get logs: ${errorMessage}`);
    }
  }

  private getLogLevel(log: any): string {
    const topics = (log.topics || '').toLowerCase();
    
    if (topics.includes('error') || topics.includes('critical')) {
      return 'error';
    }
    
    if (topics.includes('warning')) {
      return 'warning';
    }
    
    return 'info';
  }

  async getUsers(): Promise<RouterUser[]> {
    this.checkConnection();
    try {
      const usersData = await this.client!.api().write('/user/print');
      
      return usersData.map((user: any, index: number) => {
        const userObj: RouterUser = {
          id: user['.id'] || `${index + 1}`,
          name: user.name || '',
          group: user.group || '',
          disabled: user.disabled === 'true',
        };
        
        if (user['last-logged-in']) {
          userObj.lastLogin = user['last-logged-in'];
        }
        
        return userObj;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting users: ${errorMessage}`);
      throw new Error(`Failed to get users: ${errorMessage}`);
    }
  }

  async getDhcpLeases(): Promise<DhcpLease[]> {
    this.checkConnection();
    try {
      const leasesData = await this.client!.api().write('/ip/dhcp-server/lease/print');
      
      return leasesData.map((lease: any, index: number) => ({
        id: lease['.id'] || `${index + 1}`,
        address: lease.address || '',
        macAddress: lease['mac-address'] || '',
        clientId: lease['client-id'] || '',
        hostname: lease.host || lease.hostname || '',
        expires: lease['expires-after'] || '',
        server: lease.server || '',
        dynamic: lease.dynamic === 'true',
        status: lease.status || 'unknown',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting DHCP leases: ${errorMessage}`);
      throw new Error(`Failed to get DHCP leases: ${errorMessage}`);
    }
  }

  async executeCommand(command: string): Promise<any> {
    this.checkConnection();
    try {
      const result = await this.client!.api().write(command);
      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error executing command: ${errorMessage}`);
      throw new Error(`Failed to execute command: ${errorMessage}`);
    }
  }

  private checkConnection() {
    if (!this.connected || !this.client) {
      throw new Error("Not connected to MikroTik device");
    }
  }
}