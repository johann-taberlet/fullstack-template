import { redirect } from "next/navigation";
import { getSession } from "@/shared/lib/auth-middleware";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as "admin" | "client",
    image: session.user.image,
  };

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
