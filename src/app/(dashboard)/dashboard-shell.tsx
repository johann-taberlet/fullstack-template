"use client";

import { Sidebar } from "@/shared/components/ui/sidebar";
import { Header } from "@/shared/components/ui/header";
import type { AuthUser } from "@/features/auth/types";

export function DashboardShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-1">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col">
        <Header title="Dashboard" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
