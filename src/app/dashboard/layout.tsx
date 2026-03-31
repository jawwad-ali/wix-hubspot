"use client";

import { WixInstanceProvider } from "@/hooks/use-wix-instance";
import { ToastProvider } from "@/components/ui/toast";
import { NavSidebar } from "@/components/dashboard/nav-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WixInstanceProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-gray-50">
          <NavSidebar />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </ToastProvider>
    </WixInstanceProvider>
  );
}
