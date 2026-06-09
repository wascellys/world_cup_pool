"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Field } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export default function RegisterPage() {
  const router = useRouter();
  const { register, status } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await register({ name, username, password, avatar: avatar || null });
      toast.success("Conta criada com sucesso!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao cadastrar");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md">
        <div className="duo-card p-6">
          <div className="flex items-center gap-3">
            {/* <Logo /> */}
            <div>
              <h1 className="text-2xl font-extrabold">Criar conta</h1>
              <p className="text-sm text-muted">Crie um usuário e já receba o token.</p>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <Field label="Nome completo">
              <input className="duo-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>

            <Field label="Username">
              <input
                className="duo-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </Field>

            <Field label="Senha">
              <input
                className="duo-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>

            <Field label="Avatar (opcional)">
              <input className="duo-input" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
            </Field>

            <button className="duo-btn-primary w-full" disabled={status === "loading"}>
              {status === "loading" ? "Criando..." : "Criar conta"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted">Já tem conta?</span>{" "}
            <Link className="font-bold underline" href="/login">
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

