import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "error" | "warning" | "info" | "default";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        {
          "bg-green-100 text-green-800": variant === "success",
          "bg-red-100 text-red-800": variant === "error",
          "bg-yellow-100 text-yellow-800": variant === "warning",
          "bg-blue-100 text-blue-800": variant === "info",
          "bg-gray-100 text-gray-800": variant === "default",
        },
        className
      )}
      {...props}
    />
  );
}
