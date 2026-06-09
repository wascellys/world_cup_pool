"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Pool } from "@/lib/types";
import { Field } from "@/components/Field";

import { FaArrowCircleRight } from "react-icons/fa";


type TabId = "mine" | "join" | "create";

export default function DashboardPage() {
  const { user, token, requireAuth } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("mine");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedApi = useMemo(() => api({ token, baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }), [token]);

  async function loadPools() {
    setLoading(true);
    setError(null);
    try {
      const res = await authedApi.get<{ data: Pool[] }>("/pool/");
      setPools(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar bolões");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    requireAuth();
    void loadPools();
  }, [requireAuth, token]);

  if (!token) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-xl">
          <div className="duo-card p-6">
            <h1 className="text-2xl font-extrabold">Você precisa entrar</h1>
            <p className="mt-1 text-sm text-muted">O dashboard usa endpoints protegidos por token.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link className="duo-btn-primary" href="/login">
                Entrar
              </Link>
              <Link className="duo-btn-secondary" href="/register">
                Criar conta
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <header className="duo-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold">Olá, {user?.nome ?? "participante"}</h1>
              {/* <p className="mt-0.5 text-sm text-black/50">Olá, {user?.nome ?? "participante"}</p> */}
            </div>
            <Link className="duo-btn-secondary shrink-0" href="/logout">
              Sair
            </Link>
          </div>

          <nav className="mt-5 flex gap-1 border-b border-duo-border" aria-label="Seções do dashboard">
            <TabButton active={activeTab === "mine"} onClick={() => setActiveTab("mine")}>
              Meus bolões
              {pools.length > 0 ? (
                <span className="ml-1.5 rounded-full bg-duo-green/15 px-1.5 py-0.5 text-xs">{pools.length}</span>
              ) : null}
            </TabButton>
            <TabButton active={activeTab === "join"} onClick={() => setActiveTab("join")}>
              Entrar
            </TabButton>
            <TabButton active={activeTab === "create"} onClick={() => setActiveTab("create")}>
              Criar
            </TabButton>
          </nav>
        </header>

        <div className="mt-4">
          {activeTab === "mine" ? (
            <MyPoolsPanel pools={pools} loading={loading} error={error} />
          ) : null}

          {activeTab === "join" ? (
            <JoinPoolPanel
              onJoined={async () => {
                await loadPools();
                setActiveTab("mine");
              }}
            />
          ) : null}

          {activeTab === "create" ? (
            <CreatePoolPanel
              onCreated={async () => {
                await loadPools();
                setActiveTab("mine");
              }}
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center px-4 py-2.5 text-sm font-bold transition -mb-px border-b-2",
        active
          ? "border-duo-green text-duo-greenDark"
          : "border-transparent text-muted hover:text-duo-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MyPoolsPanel({
  pools,
  loading,
  error,
}: {
  pools: Pool[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="duo-card p-5">
      {loading ? <p className="text-sm text-muted">Carregando...</p> : null}
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

      {!loading && !error && pools.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-bold">Nenhum bolão ainda</p>
          <p className="mt-1 text-sm text-muted">
            Crie um novo bolão ou entre com um código na aba ao lado.
          </p>
        </div>
      ) : null}

      {!loading && pools.length > 0 ? (
        <ul className="grid gap-3">
          {pools.map((pool) => (
            <li key={pool.id}>
              <Link
                href={`/dashboard/pool/${pool.cod}`}
                className="flex items-center justify-between gap-3 rounded-duo border border-duo-border bg-duo-card/60 p-4 transition hover:border-duo-green/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{pool.name}</p>
                  <p className="text-xs text-muted">Código: {pool.cod}</p>
                </div>

                <FaArrowCircleRight className="h-5 w-5 shrink-0 text-duo-green" />


              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function JoinPoolPanel({ onJoined }: { onJoined: () => Promise<void> }) {
  const { token } = useAuth();
  const toast = useToast();
  const authedApi = useMemo(() => api({ token, baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }), [token]);

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    try {
      await authedApi.post(`/pool/${code.trim()}/save/`);
      toast.success("Você entrou no bolão com sucesso!");
      setCode("");
      await onJoined();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar no bolão");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="duo-card p-5">
      <p className="text-sm text-muted">Use o código de 8 caracteres que o organizador compartilhou.</p>

      <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
        <Field label="Código do bolão">
          <input
            className="duo-input uppercase tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex: aB3xY9zK"
            required
            minLength={8}
            maxLength={8}
          />
        </Field>

        <button className="duo-btn-primary w-full sm:w-auto" disabled={status === "saving"} type="submit">
          {status === "saving" ? "Entrando..." : "Entrar no bolão"}
        </button>
      </form>
    </div>
  );
}

function CreatePoolPanel({ onCreated }: { onCreated: () => Promise<void> }) {
  const { token } = useAuth();
  const toast = useToast();
  const authedApi = useMemo(() => api({ token, baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }), [token]);

  const [name, setName] = useState("");
  const [correctScore, setCorrectScore] = useState("3");
  const [resultScore, setResultScore] = useState("1");
  const [avatar, setAvatar] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    try {
      await authedApi.post("/pool/", {
        name,
        correct_score: correctScore,
        result_score: resultScore,
        avatar: avatar || null,
        is_public: isPublic,
      });
      setName("");
      setAvatar("");
      toast.success("Bolão criado com sucesso!");
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar bolão");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="duo-card p-5">
      <p className="text-sm text-muted">Defina o nome e quantos pontos cada acerto vale.</p>

      <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
        <Field label="Nome do bolão">
          <input className="duo-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Pontos placar exato">
            <input
              className="duo-input"
              value={correctScore}
              onChange={(e) => setCorrectScore(e.target.value)}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label="Pontos resultado">
            <input
              className="duo-input"
              value={resultScore}
              onChange={(e) => setResultScore(e.target.value)}
              inputMode="numeric"
              required
            />
          </Field>
        </div>

        <Field label="Avatar (opcional)">
          <input className="duo-input" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
        </Field>

        <Field label="Tipo do bolão">
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="isPublic"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
              />
              Privado
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="isPublic"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
              />
              Público
            </label>
          </div>
        </Field>

        <button className="duo-btn-primary w-full sm:w-auto" disabled={status === "saving"} type="submit">
          {status === "saving" ? "Criando..." : "Criar bolão"}
        </button>
      </form>
    </div>
  );
}
