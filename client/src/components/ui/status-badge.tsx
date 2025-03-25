import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "up" | "down" | "running" | "disabled" | boolean;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({
  status,
  showLabel = true,
  className,
  size = "md"
}: StatusBadgeProps) {
  // Normalize the status to a boolean
  let isActive: boolean;
  let label: string;

  if (typeof status === "boolean") {
    isActive = status;
    label = isActive ? "Active" : "Inactive";
  } else {
    isActive = status === "up" || status === "running";
    label = status;
  }

  // Size classes
  const sizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3"
  };

  return (
    <div className="flex items-center">
      <span
        className={cn(
          "rounded-full mr-1.5",
          sizeClasses[size],
          isActive ? "bg-green-500" : "bg-red-500",
          className
        )}
      />
      {showLabel && (
        <span className="capitalize text-sm">{label}</span>
      )}
    </div>
  );
}
