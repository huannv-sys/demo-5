import { ComponentType, ReactNode } from 'react';

// Type definitions for components and app state

// Sidebar item interface
export interface SidebarItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  section?: string;
}

// App context interface
export interface IAppContext {
  selectedRouterId: number | null;
  setSelectedRouterId: (id: number | null) => void;
  connected: boolean;
  setConnected: (status: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

// Dashboard card props
export interface ResourceCardProps {
  title: string;
  value: string | number | ReactNode;
  icon: string;
  iconColor: string;
  change?: {
    value: string | number;
    increase: boolean;
  };
  progress?: {
    value: number;
    color: string;
  };
  footer?: ReactNode;
}

// Status indicator props
export interface StatusIndicatorProps {
  status: boolean;
  text?: string;
  className?: string;
}

// DataRow type for various tables
export interface DataRow {
  id: string;
  [key: string]: any;
}

// Column definition for tables
export interface ColumnDef {
  id: string;
  header: string;
  accessorKey?: string;
  cell?: (info: { row: { original: any } }) => ReactNode;
  className?: string;
}

// Simple search props
export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Time range selector props
export interface TimeRangeProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

// Action button props
export interface ActionButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
}

// Modal props
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Tab definition
export interface TabDefinition {
  id: string;
  label: string;
  content: ComponentType<any>;
}

// Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
}

// Connection form data
export interface ConnectionFormData {
  name: string;
  address: string;
  port: number;
  username: string;
  password: string;
  isDefault: boolean;
}
