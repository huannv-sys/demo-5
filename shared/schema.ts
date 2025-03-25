import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// RouterOS device connection schema
export const routerConnections = pgTable("router_connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  port: integer("port").notNull().default(8728),
  username: text("username").notNull(),
  password: text("password").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  lastConnected: timestamp("last_connected"),
});

export const insertRouterConnectionSchema = createInsertSchema(routerConnections).pick({
  name: true,
  address: true,
  port: true,
  username: true,
  password: true,
  isDefault: true,
});

export type InsertRouterConnection = z.infer<typeof insertRouterConnectionSchema>;
export type RouterConnection = typeof routerConnections.$inferSelect;

// Log entry storage
export const logEntries = pgTable("log_entries", {
  id: serial("id").primaryKey(),
  routerId: integer("router_id").references(() => routerConnections.id),
  time: timestamp("time").notNull(),
  topics: text("topics").notNull(),
  message: text("message").notNull(),
  level: text("level").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLogEntrySchema = createInsertSchema(logEntries).pick({
  routerId: true,
  time: true,
  topics: true,
  message: true,
  level: true,
});

export type InsertLogEntry = z.infer<typeof insertLogEntrySchema>;
export type LogEntry = typeof logEntries.$inferSelect;

// System info schemas (used for API responses)
export const resourceInfoSchema = z.object({
  cpuLoad: z.number(),
  cpuCount: z.number(),
  uptime: z.string(),
  version: z.string(),
  freeMemory: z.number(),
  totalMemory: z.number(),
  freeHdd: z.number(),
  totalHdd: z.number(),
  boardName: z.string(),
  architecture: z.string(),
});

export type ResourceInfo = z.infer<typeof resourceInfoSchema>;

export const interfaceSchema = z.object({
  name: z.string(),
  type: z.string(),
  mtu: z.number().optional(),
  actualMtu: z.number().optional(),
  l2mtu: z.number().optional(),
  macAddress: z.string().optional(),
  running: z.boolean(),
  disabled: z.boolean(),
  rxBytes: z.number().optional(),
  txBytes: z.number().optional(),
  rxPackets: z.number().optional(),
  txPackets: z.number().optional(),
  addresses: z.array(z.object({
    address: z.string(),
    network: z.string(),
    interface: z.string()
  })).optional(),
});

export type Interface = z.infer<typeof interfaceSchema>;

export const wirelessSchema = z.object({
  id: z.string(),
  interface: z.string(),
  ssid: z.string(),
  security: z.string().optional(),
  disabled: z.boolean(),
  clients: z.number().optional(),
  channel: z.string().optional(),
  band: z.string().optional(),
  frequency: z.number().optional(),
  mode: z.string().optional(),
});

export type Wireless = z.infer<typeof wirelessSchema>;

export const wirelessClientSchema = z.object({
  id: z.string(),
  interface: z.string(),
  macAddress: z.string(),
  lastActivity: z.number().optional(),
  signalStrength: z.number().optional(),
  txRate: z.number().optional(),
  rxRate: z.number().optional(),
  uptime: z.string().optional(),
  name: z.string().optional(),
});

export type WirelessClient = z.infer<typeof wirelessClientSchema>;

export const firewallRuleSchema = z.object({
  id: z.string(),
  chain: z.string(),
  action: z.string(),
  srcAddress: z.string().optional(),
  dstAddress: z.string().optional(),
  protocol: z.string().optional(),
  srcPort: z.string().optional(),
  dstPort: z.string().optional(),
  disabled: z.boolean(),
  comment: z.string().optional(),
  bytes: z.number().optional(),
  packets: z.number().optional(),
});

export type FirewallRule = z.infer<typeof firewallRuleSchema>;

export const routingRuleSchema = z.object({
  id: z.string(),
  dstAddress: z.string(),
  gateway: z.string(),
  distance: z.number(),
  static: z.boolean(),
  disabled: z.boolean(),
  active: z.boolean(),
});

export type RoutingRule = z.infer<typeof routingRuleSchema>;

export const arpEntrySchema = z.object({
  id: z.string(),
  address: z.string(),
  macAddress: z.string(),
  interface: z.string(),
  dynamic: z.boolean(),
  invalid: z.boolean(),
  complete: z.boolean(),
});

export type ArpEntry = z.infer<typeof arpEntrySchema>;

export const logSchema = z.object({
  id: z.string(),
  time: z.string(),
  topics: z.string(),
  message: z.string(),
  level: z.string(),
});

export type Log = z.infer<typeof logSchema>;

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.string(),
  disabled: z.boolean(),
  lastLogin: z.string().optional(),
});

export type RouterUser = z.infer<typeof userSchema>;

export const dhcpLeaseSchema = z.object({
  id: z.string(),
  address: z.string(),
  macAddress: z.string(),
  clientId: z.string().optional(),
  hostname: z.string().optional(),
  expires: z.string().optional(),
  server: z.string(),
  dynamic: z.boolean(),
  status: z.string(),
});

export type DhcpLease = z.infer<typeof dhcpLeaseSchema>;

export const bandwidthDataSchema = z.object({
  interface: z.string(),
  download: z.array(z.object({
    time: z.string(),
    value: z.number(),
  })),
  upload: z.array(z.object({
    time: z.string(),
    value: z.number(),
  })),
});

export type BandwidthData = z.infer<typeof bandwidthDataSchema>;
