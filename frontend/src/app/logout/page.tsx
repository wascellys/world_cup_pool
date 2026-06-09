"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default function LogoutPage() {
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    logout();
    router.replace("/");
  }, [logout, router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <div className="duo-card p-6">
          <p className="font-extrabold">Saindo...</p>
        </div>
      </div>
    </AppShell>
  );
}

