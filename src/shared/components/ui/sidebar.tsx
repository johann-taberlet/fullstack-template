"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/features/auth/types";

const adminLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projets" },
  { href: "/clients", label: "Clients" },
  { href: "/invoices", label: "Factures" },
  { href: "/settings", label: "Paramètres" },
];

const clientLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Mes projets" },
  { href: "/settings", label: "Paramètres" },
];

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const links = user.role === "admin" ? adminLinks : clientLinks;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-neutral-50 p-4">
      <div className="mb-6">
        <span className="text-lg font-bold">Joki</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-2 text-sm ${
                active
                  ? "bg-neutral-200 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t pt-3 text-sm text-neutral-500">
        {user.name}
      </div>
    </aside>
  );
}
