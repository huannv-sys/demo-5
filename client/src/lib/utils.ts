import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper function for merging class names with Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format bytes to human-readable size (KB, MB, GB, etc.)
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Format Mikrotik uptime string to readable format
export function formatUptime(uptime: string): string {
  // Mikrotik uptime format: "15d7h32m" -> "15 days 7 hours 32 minutes"
  const regex = /(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
  const matches = uptime.match(regex);
  
  if (!matches) return uptime;
  
  const [, weeks, days, hours, minutes, seconds] = matches;
  
  const parts = [];
  if (weeks) parts.push(`${weeks} week${weeks !== '1' ? 's' : ''}`);
  if (days) parts.push(`${days} day${days !== '1' ? 's' : ''}`);
  if (hours) parts.push(`${hours} hour${hours !== '1' ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} minute${minutes !== '1' ? 's' : ''}`);
  if (seconds) parts.push(`${seconds} second${seconds !== '1' ? 's' : ''}`);
  
  return parts.join(' ');
}

// Format date to locale string
export function formatDate(date: string | Date): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Get connection status display data
export function getConnectionStatusInfo(status: boolean): {
  color: string;
  bgColor: string;
  pulseClass: string;
  text: string;
} {
  if (status) {
    return {
      color: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-green-100 dark:bg-green-900',
      pulseClass: 'bg-green-500 pulse',
      text: 'Connected'
    };
  } else {
    return {
      color: 'text-red-700 dark:text-red-300',
      bgColor: 'bg-red-100 dark:bg-red-900',
      pulseClass: 'bg-red-500',
      text: 'Disconnected'
    };
  }
}

// Format log level to display properties
export function getLogLevelInfo(level: string): {
  bgColor: string;
  textColor: string;
  label: string;
} {
  switch (level.toLowerCase()) {
    case 'info':
      return {
        bgColor: 'bg-blue-100 dark:bg-blue-900',
        textColor: 'text-blue-800 dark:text-blue-300',
        label: 'info'
      };
    case 'warning':
      return {
        bgColor: 'bg-yellow-100 dark:bg-yellow-900',
        textColor: 'text-yellow-800 dark:text-yellow-300',
        label: 'warning'
      };
    case 'error':
      return {
        bgColor: 'bg-red-100 dark:bg-red-900',
        textColor: 'text-red-800 dark:text-red-300',
        label: 'error'
      };
    case 'debug':
      return {
        bgColor: 'bg-purple-100 dark:bg-purple-900',
        textColor: 'text-purple-800 dark:text-purple-300',
        label: 'debug'
      };
    default:
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-900',
        textColor: 'text-gray-800 dark:text-gray-300',
        label: level
      };
  }
}

// Format interface status to display properties
export function getInterfaceStatusInfo(running: boolean, disabled: boolean): {
  color: string;
  indicator: string;
  text: string;
} {
  if (disabled) {
    return {
      color: 'text-gray-500',
      indicator: 'bg-gray-500',
      text: 'Disabled'
    };
  } else if (running) {
    return {
      color: 'text-green-700 dark:text-green-300',
      indicator: 'bg-green-500',
      text: 'Up'
    };
  } else {
    return {
      color: 'text-red-700 dark:text-red-300',
      indicator: 'bg-red-500',
      text: 'Down'
    };
  }
}

// Get color for chart based on index
export function getChartColor(index: number): string {
  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];
  
  return colors[index % colors.length];
}
