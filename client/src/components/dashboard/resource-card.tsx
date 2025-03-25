import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface ResourceCardProps {
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

export function ResourceCard({
  title,
  value,
  icon,
  iconColor,
  change,
  progress,
  footer
}: ResourceCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">{title}</h2>
          <span className={`material-icons ${iconColor}`}>{icon}</span>
        </div>
        <div className="flex items-end space-x-2">
          <div className="text-2xl font-medium">{value}</div>
          {change && (
            <div className={`text-sm ${change.increase ? 'text-red-500' : 'text-green-500'} flex items-center`}>
              <span className="material-icons text-sm">
                {change.increase ? 'arrow_upward' : 'arrow_downward'}
              </span>
              <span>{change.value}</span>
            </div>
          )}
        </div>
        
        {progress && (
          <div className="mt-4 bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
            <div 
              className={`${progress.color} h-2 rounded-full`} 
              style={{ width: `${Math.min(progress.value, 100)}%` }}
            ></div>
          </div>
        )}
        
        {footer && (
          <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
