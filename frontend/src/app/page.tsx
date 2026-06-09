import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import cup from "@/assets/FIFA-2026.png";

export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <div className="duo-card p-6">
          <div className="flex items-center gap-3">
            {/* <Logo /> */}
            <div>
              <h1 className="text-2xl font-extrabold">Bolão da Copa do Mundo</h1>
            </div>

          </div>

          <div className="mt-6 grid gap-3">
            <div className="flex items-center justify-center">
              <img
                style={{ height: "300px" }}
                src={cup.src}
                alt="Ícone de bola de futebol"
              />
            </div>
            <Link className="duo-btn-primary w-full" href="/login">
              Entrar
            </Link>
            <Link className="duo-btn-secondary w-full" href="/register">
              Criar conta
            </Link>
            <Link className="text-center text-sm underline" href="/dashboard">
              Ir para o dashboard
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

