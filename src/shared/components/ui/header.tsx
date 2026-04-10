"use client";

import { signOut } from "@/features/auth/client";
import { useRouter } from "next/navigation";

export function Header({ title }: { title: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <button
        type="button"
        onClick={handleSignOut}
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        Déconnexion
      </button>
    </header>
  );
}
