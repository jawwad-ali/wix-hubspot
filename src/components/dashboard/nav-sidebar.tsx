"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ListOrdered,
  Settings,
  FileText,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/field-mapping", label: "Field Mapping", icon: ArrowLeftRight },
  { href: "/dashboard/sync-log", label: "Sync Log", icon: ListOrdered },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="font-bold text-gray-900 text-sm">Wix-HubSpot</h1>
            <p className="text-xs text-gray-500">Contact Sync</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
