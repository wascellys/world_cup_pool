"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Game, Guess, GuessImportOption, Pool, RankingEntry, ParticipantPool } from "@/lib/types";

type GuessDraft = {
  first: string;
  second: string;
};

type ImportGuessModalState = {
  game: Game;
  options: GuessImportOption[];
  selectedOptionId: number | null;
  loading: boolean;
  error: string | null;
};

type RankingViewType = "general" | "byPeriod";
type TabId = "games" | "participants" | "ranking";
type GamesSection = "today" | "upcoming" | "all";
type ParticipantsSection = "all" | "requests";

const APP_TIME_ZONE = "America/Sao_Paulo";

export default function PoolGamesPage() {
  const params = useParams();
  const cod = String(params.cod ?? "");
  const { token, requireAuth } = useAuth();
  const toast = useToast();
  const authedApi = useMemo(() => api({ token, baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }), [token]);

  const [pool, setPool] = useState<Pool | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<number, GuessDraft>>({});
  const [activeTab, setActiveTab] = useState<TabId>("games");
  const [rankingViewType, setRankingViewType] = useState<RankingViewType>("general");
  const [periodStartDate, setPeriodStartDate] = useState<string>("");
  const [periodEndDate, setPeriodEndDate] = useState<string>("");
  const [gamesTab, setGamesTab] = useState<GamesSection>("today");
  const [isOwner, setIsOwner] = useState(false);
  const [participantsTab, setParticipantsTab] = useState<ParticipantsSection>("all");
  const [participants, setParticipants] = useState<ParticipantPool[]>([]);
  const [pendingParticipants, setPendingParticipants] = useState<ParticipantPool[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantPool | null>(null);
  const [participantHistory, setParticipantHistory] = useState<Guess[]>([]);
  const [importGuessModal, setImportGuessModal] = useState<ImportGuessModalState | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [savingDayKey, setSavingDayKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) return;
    requireAuth();
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cod, requireAuth, token]);

  async function loadPage(showLoading = true) {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const poolResponse = await authedApi.get<Pool>(`/pool/${cod}/`);
      setPool(poolResponse);

      const authData = await authedApi.get<any>(`/auth/me/`);
      const ownerId = typeof poolResponse.owner === 'number' ? poolResponse.owner : (poolResponse.owner as any)?.id;
      const isPoolOwner = ownerId === authData.id;
      setIsOwner(isPoolOwner);

      if (isPoolOwner || poolResponse.is_participant) {
        try {
          const participantsResponse = await authedApi.get<any>(`/pool/${cod}/participants/`);
          // API may return either an array or an object with .data
          const participantsData: ParticipantPool[] = Array.isArray(participantsResponse)
            ? participantsResponse
            : participantsResponse.data ?? [];
          setParticipants(participantsData);
        } catch (err) {
          setParticipants([]);
        }

        if (isPoolOwner) {
          try {
            const pendingResponse = await authedApi.get<any>(`/pool/${cod}/pending_participants/`);
            const pendingData: ParticipantPool[] = pendingResponse.data ?? [];
            setPendingParticipants(pendingData);
          } catch (err) {
            setPendingParticipants([]);
          }
        }
      } else {
        setParticipants([]);
      }

      if (!poolResponse.is_participant) {
        setGames([]);
        setRanking([]);
        setDrafts({});
        return;
      }

      const [gamesResponse, rankingResponse] = await Promise.all([
        authedApi.get<{ data: Game[] }>(`/game/?pool=${cod}`),
        authedApi.get<{ data: RankingEntry[] }>(`/pool/${cod}/ranking/`),
      ]);

      const loadedGames = gamesResponse.data ?? [];
      setGames(loadedGames);
      setRanking(rankingResponse.data ?? []);
      setDrafts(buildDrafts(loadedGames));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar jogos";
      setError(message);
      toast.error(message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function handleSaveGuesses(dayKey: string, dayGames: Game[]) {
    setSavingDayKey(dayKey);
    setError(null);

    const results: { game: Game; response?: Guess; error?: string }[] = [];
    const currentTime = Date.now();
    const openDayGames = dayGames.filter((game) => !isGameClosed(game, currentTime));

    if (openDayGames.length === 0) {
      const message = "O prazo para enviar o palpite encerrou!";
      setError(message);
      toast.error(message);
      setNow(currentTime);
      setSavingDayKey(null);
      return;
    }

    for (const game of openDayGames) {

      const draft = drafts[game.id] ?? { first: "", second: "" };
      const first = draft.first.trim() === "" ? "0" : draft.first;
      const second = draft.second.trim() === "" ? "0" : draft.second;

      const hasChanged =
        !game.guessed ||
        game.guessed.guess_first_team !== first ||
        game.guessed.guess_second_team !== second;

      if (game.guessed && !hasChanged) continue;

      try {
        const payload = {
          pool: cod,
          game: game.id,
          guess_first_team: first,
          guess_second_team: second,
        };

        const response = game.guessed
          ? await authedApi.patch<Guess>(`/guess/${game.guessed.id}/`, payload)
          : await authedApi.post<Guess>(`/guess/`, payload);

        results.push({ game, response });
      } catch (err) {
        results.push({ game, error: err instanceof Error ? err.message : "Erro ao salvar palpite" });
      }
    }

    const errors = results.filter((result) => result.error).map((result) => result.error!);
    const successful = results.filter((result) => result.response);

    if (successful.length > 0) {
      toast.success(
        successful.length === 1 ? "Palpite salvo com sucesso!" : `${successful.length} palpites salvos com sucesso!`,
      );
      await loadPage(false);
    }

    if (errors.length > 0) {
      setError(errors[0]);
      toast.error(errors[0]);
    }

    setSavingDayKey(null);
  }

  async function handleJoinPool() {
    setJoining(true);
    setError(null);
    try {
      await authedApi.post(`/pool/${cod}/save/`);
      toast.success("Seu pedido foi enviado! Aguarde aprovação do criador do bolão.");
      await loadPage();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao entrar no bolão";
      setError(message);
      toast.error(message);
    } finally {
      setJoining(false);
    }
  }

  async function handleApproveParticipant(participantPoolId: number) {
    try {
      await authedApi.post(`/pool/${cod}/approve_participant/`, { participant_pool_id: participantPoolId });
      toast.success("Participante aprovado!");
      await loadPage(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao aprovar participante";
      toast.error(message);
    }
  }

  async function handleRejectParticipant(participantPoolId: number) {
    try {
      await authedApi.post(`/pool/${cod}/reject_participant/`, { participant_pool_id: participantPoolId });
      toast.success("Participante recusado!");
      await loadPage(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao recusar participante";
      toast.error(message);
    }
  }

  function handlePeriodStartDateChange(date: string) {
    setRankingViewType("byPeriod");
    setPeriodStartDate(date);
  }

  function handlePeriodEndDateChange(date: string) {
    setRankingViewType("byPeriod");
    setPeriodEndDate(date);
  }

  const allGamesByDay = useMemo(() => groupGamesByDay(games), [games]);
  const todayKey = getLocalDateKey(new Date(now));
  const todayGames = allGamesByDay.get(todayKey) ?? [];

  const sortedParticipants = useMemo(() => {
    return participants.slice().sort((a, b) => {
      const nameA = `${a.participant.name}`;
      const nameB = `${b.participant.name}`;
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      // fallback to created_at
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });
  }, [participants]);

  async function loadParticipantHistory(participantPoolId: number) {
    setLoadingHistory(true);
    setParticipantHistory([]);
    try {
      const res = await authedApi.get<any>(`/pool/${cod}/participant_guesses/?participant_pool_id=${participantPoolId}`);
      const data: Guess[] = res.data ?? res ?? [];
      setParticipantHistory(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar histórico');
      setParticipantHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function openParticipant(pp: ParticipantPool) {
    setSelectedParticipant(pp);
    void loadParticipantHistory(pp.id);
  }

  function closeParticipant() {
    setSelectedParticipant(null);
    setParticipantHistory([]);
  }

  async function openImportGuessModal(game: Game) {
    setImportGuessModal({
      game,
      options: [],
      selectedOptionId: null,
      loading: true,
      error: null,
    });

    try {
      const response = await authedApi.get<{ data: GuessImportOption[] }>(
        `/guess/import_options/?pool=${cod}&game=${game.id}`,
      );
      const options = response.data ?? [];
      setImportGuessModal({
        game,
        options,
        selectedOptionId: options[0]?.id ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar palpites";
      setImportGuessModal({
        game,
        options: [],
        selectedOptionId: null,
        loading: false,
        error: message,
      });
    }
  }

  function closeImportGuessModal() {
    setImportGuessModal(null);
  }

  function selectImportGuessOption(optionId: number) {
    setImportGuessModal((current) => current ? { ...current, selectedOptionId: optionId } : current);
  }

  function saveImportedGuess() {
    if (!importGuessModal?.selectedOptionId) return;
    const selectedOption = importGuessModal.options.find((option) => option.id === importGuessModal.selectedOptionId);
    if (!selectedOption) return;

    setDrafts((current) => ({
      ...current,
      [importGuessModal.game.id]: {
        first: selectedOption.guess_first_team,
        second: selectedOption.guess_second_team,
      },
    }));
    closeImportGuessModal();
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(cod);
      toast.success("Código copiado!");
    } catch (err) {
      toast.error("Não foi possível copiar o código.");
    }
  }

  const allGameDayEntries = useMemo(
    () => Array.from(allGamesByDay.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [allGamesByDay],
  );
  const upcomingGamesByDay = useMemo(
    () => groupGamesByDay(games.filter((game) => !hasOfficialScore(game))),
    [games],
  );
  const upcomingGameDayEntries = useMemo(
    () => Array.from(upcomingGamesByDay.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [upcomingGamesByDay],
  );
  const gamesById = useMemo(
    () => new Map(games.map((game) => [game.id, game])),
    [games],
  );
  const completedParticipantHistory = useMemo(
    () =>
      participantHistory
        .filter((guess) => {
          const game = gamesById.get(guess.game);
          return game ? isGameClosed(game, now) : false;
        })
        .sort((a, b) => {
          const gameA = gamesById.get(a.game);
          const gameB = gamesById.get(b.game);
          const timeA = gameA ? new Date(gameA.date_game).getTime() : 0;
          const timeB = gameB ? new Date(gameB.date_game).getTime() : 0;

          if (timeA !== timeB) return timeB - timeA;
          return b.id - a.id;
        }),
    [gamesById, now, participantHistory],
  );

  if (!token) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-xl">
          <div className="duo-card p-6">
            <h1 className="text-2xl font-extrabold">Você precisa entrar</h1>
            {/* <p className="mt-1 text-sm text-muted">A tela de jogos usa endpoints protegidos por token.</p> */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link className="duo-btn-primary" href="/login">
                Entrar
              </Link>
              <Link className="duo-btn-secondary" href="/dashboard">
                Voltar ao dashboard
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
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold">{pool?.name ?? "Bolão"}</h1>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted transition hover:text-duo-greenDark"
                title="Copiar código"
              >
                <span>Código:</span>
                <span className="font-extrabold tracking-wide text-duo-ink">{cod}</span>
              </button>
            </div>
            <Link className="duo-btn-secondary shrink-0" href="/dashboard">
              Voltar
            </Link>
          </div>

          {pool && (pool.is_participant || isOwner) ? (
            <nav className="mt-5 flex gap-1 border-b border-duo-border" aria-label="Seções do bolão">
              <TabButton active={activeTab === "games"} onClick={() => setActiveTab("games")}>Jogos</TabButton>
              <TabButton active={activeTab === "participants"} onClick={() => { setActiveTab("participants"); setParticipantsTab("all"); }}>
                Participantes
              </TabButton>
              <TabButton active={activeTab === "ranking"} onClick={() => setActiveTab("ranking")}>Ranking</TabButton>
              {isOwner && pendingParticipants.length > 0 ? (
                <span className="inline-flex items-center rounded-full bg-duo-green/10 px-3 py-1 text-xs font-bold text-duo-green">
                  {pendingParticipants.length} solicitação{pendingParticipants.length === 1 ? "" : "ões"}
                </span>
              ) : null}
            </nav>
          ) : null}
        </header>

        <div className="mt-4">
          {loading ? <p className="text-sm text-muted">Carregando...</p> : null}
          {error ? <p className="mb-4 text-sm font-bold text-red-600">{error}</p> : null}

          {!loading && pool && !pool.is_participant ? (
            isOwner ? (
              <div className="space-y-4">
                <div className="duo-card p-6">
                  <h2 className="font-bold">Pedidos de Entrada Pendentes</h2>
                  {pendingParticipants.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">Nenhum pedido pendente no momento.</p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {pendingParticipants.map((pp) => (
                        <div
                          key={pp.id}
                          className="flex items-center justify-between rounded-duo border border-duo-border bg-duo-card/60 px-4 py-3"
                        >
                          <div>
                            <p className="font-bold">{pp.participant.name}</p>
                            <p className="text-xs text-muted">@{pp.participant.name}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => void handleApproveParticipant(pp.id)}
                              className="duo-btn-primary px-3 py-2 text-sm"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => void handleRejectParticipant(pp.id)}
                              className="duo-btn-secondary px-3 py-2 text-sm"
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="duo-card p-6">
                <p className="font-bold">Você ainda não participa deste bolão.</p>
                <p className="mt-1 text-sm text-muted">Envie um pedido para o criador aprovar sua entrada.</p>
                <button
                  className="duo-btn-primary mt-4"
                  disabled={joining}
                  onClick={() => void handleJoinPool()}
                  type="button"
                >
                  {joining ? "Enviando..." : "Solicitar Entrada"}
                </button>
              </div>
            )
          ) : null}

          {!loading && pool && activeTab === "participants" ? (
            <div className="space-y-4">
              <div className="duo-card p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setParticipantsTab("all")}
                    className={`px-4 py-2 rounded-duo font-bold text-sm ${participantsTab === "all" ? "bg-duo-green text-white" : "bg-duo-card border border-duo-border text-duo-ink hover:border-duo-green"}`}
                  >
                    Todos
                  </button>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => setParticipantsTab("requests")}
                      className={`px-4 py-2 rounded-duo font-bold text-sm ${participantsTab === "requests" ? "bg-duo-green text-white" : "bg-duo-card border border-duo-border text-duo-ink hover:border-duo-green"}`}
                    >
                      Solicitações
                    </button>
                  ) : null}
                </div>

                {participantsTab === "all" ? (
                  sortedParticipants.length === 0 ? (
                    <div className="duo-card p-6">
                      <p className="font-bold">Nenhum participante encontrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedParticipants.map((pp) => (
                        <div
                          key={pp.id}
                          onClick={() => openParticipant(pp)}
                          role="button"
                          tabIndex={0}
                          className="flex cursor-pointer items-center justify-between rounded-duo border border-duo-border bg-duo-card/60 px-4 py-3"
                        >
                          <div>
                            <p className="font-bold">{pp.participant.name}</p>
                            {pp.created_at ? <p className="text-xs text-muted">Entrou em {new Date(pp.created_at).toLocaleDateString()}</p> : null}
                          </div>
                          <span className="rounded-full bg-duo-green/10 px-3 py-1 text-xs font-bold text-duo-green">Aprovado</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {pendingParticipants.length === 0 ? (
                      <div className="duo-card p-6">
                        <p className="font-bold">Nenhuma solicitação pendente no momento.</p>
                      </div>
                    ) : (
                      pendingParticipants.map((pp) => (
                        <div key={pp.id} className="flex items-center justify-between rounded-duo border border-duo-border bg-duo-card/60 px-4 py-3">
                          <div>
                            <p className="font-bold">{pp.participant.name}</p>
                            <p className="text-xs text-muted">@{pp.participant.name}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => void handleApproveParticipant(pp.id)}
                              className="duo-btn-primary px-3 py-2 text-sm"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => void handleRejectParticipant(pp.id)}
                              className="duo-btn-secondary px-3 py-2 text-sm"
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {!loading && pool && pool.is_participant && activeTab === "ranking" ? (
            <RankingPanel
              pool={pool}
              ranking={ranking}
              games={games}
              viewType={rankingViewType}
              onViewTypeChange={setRankingViewType}
              periodStartDate={periodStartDate}
              onPeriodStartDateChange={handlePeriodStartDateChange}
              periodEndDate={periodEndDate}
              onPeriodEndDateChange={handlePeriodEndDateChange}
              now={now}
              onParticipantClick={(participantId: number) => {
                const pp = participants.find((p) => p.participant.id === participantId);
                if (pp) openParticipant(pp);
                else toast.error('Informação do participante não encontrada.');
              }}
            />
          ) : null}

          {!loading && pool && activeTab === "games" ? (
            <div className="space-y-4">
              <div className="duo-card p-5">
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-duo font-bold text-sm ${gamesTab === "today" ? "bg-duo-green text-white" : "bg-duo-card border border-duo-border text-duo-ink hover:border-duo-green"}`}
                    onClick={() => setGamesTab("today")}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-duo font-bold text-sm ${gamesTab === "upcoming" ? "bg-duo-green text-white" : "bg-duo-card border border-duo-border text-duo-ink hover:border-duo-green"}`}
                    onClick={() => setGamesTab("upcoming")}
                  >
                    Proximos
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-duo font-bold text-sm ${gamesTab === "all" ? "bg-duo-green text-white" : "bg-duo-card border border-duo-border text-duo-ink hover:border-duo-green"}`}
                    onClick={() => setGamesTab("all")}
                  >
                    Todos
                  </button>
                </div>
              </div>

              {pool.is_participant && gamesTab === "today" ? (
                <GamesDayPanel
                  dayKey={todayKey}
                  label={formatDateLabel(new Date(now), true)}
                  games={todayGames}
                  drafts={drafts}
                  onDraftChange={setDrafts}
                  onImportGuess={openImportGuessModal}
                  onSave={() => void handleSaveGuesses(todayKey, todayGames)}
                  saving={savingDayKey === todayKey}
                  now={now}
                  emptyMessage="Nenhum jogo programado para hoje."
                />
              ) : null}

              {pool.is_participant && gamesTab === "upcoming" ? (
                upcomingGameDayEntries.length === 0 ? (
                  <div className="duo-card p-6">
                    <p className="font-bold">Nenhum jogo sem resultado cadastrado.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {upcomingGameDayEntries.map(([dayKey, dayGames]) => (
                      <GamesDayPanel
                        key={dayKey}
                        dayKey={dayKey}
                        label={formatDateLabel(new Date(`${dayKey}T12:00:00`), dayKey === todayKey)}
                        games={dayGames}
                        drafts={drafts}
                        onDraftChange={setDrafts}
                        onImportGuess={openImportGuessModal}
                        onSave={() =>
                          void handleSaveGuesses(dayKey, dayGames)
                        }
                        saving={savingDayKey === dayKey}
                        now={now}
                      />
                    ))}
                  </div>
                )
              ) : null}

              {pool.is_participant && gamesTab === "all" ? (
                games.length === 0 ? (
                  <div className="duo-card p-6">
                    <p className="font-bold">Nenhum jogo cadastrado ainda.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {allGameDayEntries.map(([dayKey, dayGames]) => (
                      <GamesDayPanel
                        key={dayKey}
                        dayKey={dayKey}
                        label={formatDateLabel(new Date(`${dayKey}T12:00:00`), dayKey === todayKey)}
                        games={dayGames}
                        drafts={drafts}
                        onDraftChange={setDrafts}
                        onImportGuess={openImportGuessModal}
                        onSave={() =>
                          void handleSaveGuesses(dayKey, dayGames)
                        }
                        saving={savingDayKey === dayKey}
                        now={now}
                      />
                    ))}
                  </div>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {selectedParticipant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-2xl">
            <div className="duo-card flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-4 sm:p-5">
              <div className="flex shrink-0 items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold">{selectedParticipant.participant.name}</h3>
                  {selectedParticipant.created_at ? <p className="text-xs text-muted">Entrou em {new Date(selectedParticipant.created_at).toLocaleString()}</p> : null}
                </div>
                <button className="duo-btn-secondary shrink-0" onClick={closeParticipant} type="button">Fechar</button>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <h4 className="shrink-0 font-bold">Histórico de palpites</h4>
                {loadingHistory ? (
                  <p className="text-sm text-muted">Carregando...</p>
                ) : completedParticipantHistory.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Nenhum palpite de jogo encerrado encontrado para este participante.</p>
                ) : (
                  <div className="mt-3 min-h-0 space-y-3 overflow-y-auto pr-1">
                    {completedParticipantHistory.map((g) => {
                      const game = gamesById.get(g.game);
                      return (
                        <div key={g.id} className="rounded-duo border border-duo-border bg-duo-card/60 px-3 py-3 sm:px-4">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold leading-snug sm:text-base">{game ? `${game.first_team.name} x ${game.second_team.name}` : `Jogo ${g.game}`}</p>
                              <p className="text-xs text-muted">Data: {game ? formatDateLabel(new Date(game.date_game), false) : '-'}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="whitespace-nowrap text-[13px] font-extrabold tabular-nums sm:text-sm">Palpite: {g.guess_first_team} x {g.guess_second_team}</p>
                              <p className="text-xs text-muted">Pontos: {g.points_earned ?? g.points_earned === 0 ? g.points_earned : '-'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {importGuessModal ? (
        <ImportGuessModal
          state={importGuessModal}
          onSelect={selectImportGuessOption}
          onSave={saveImportedGuess}
          onCancel={closeImportGuessModal}
        />
      ) : null}
    </AppShell>
  );
}

function ImportGuessModal({
  state,
  onSelect,
  onSave,
  onCancel,
}: {
  state: ImportGuessModalState;
  onSelect: (optionId: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { game, options, selectedOptionId, loading, error } = state;
  const canSave = selectedOptionId != null && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg">
        <div className="duo-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold">Importar palpite</h3>
              <p className="mt-1 text-xs text-muted">
                {formatTeamCode(game.first_team.name, game.first_team.code)} x {formatTeamCode(game.second_team.name, game.second_team.code)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : error ? (
              <p className="text-sm font-bold text-red-600">{error}</p>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted">Nenhum palpite encontrado em outros bolões para este jogo.</p>
            ) : (
              <div className="space-y-2">
                {options.map((option) => {
                  const selected = selectedOptionId === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-duo border px-4 py-3 transition ${selected
                          ? "border-duo-green bg-duo-green/10"
                          : "border-duo-border bg-duo-card/60 hover:border-duo-green/50"
                        }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold">{option.pool_name}</p>
                        <ImportGuessScore game={game} option={option} />
                      </div>
                      <input
                        type="checkbox"
                        name="import-guess-option"
                        checked={selected}
                        onChange={() => onSelect(option.id)}
                        className="h-4 w-4 shrink-0 accent-duo-green"
                        aria-label={`Importar palpite do bolão ${option.pool_name}`}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button className="duo-btn-secondary px-4 py-2 text-sm" onClick={onCancel} type="button">
              Cancelar
            </button>
            <button
              className="duo-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onSave}
              disabled={!canSave}
              type="button"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportGuessScore({ game, option }: { game: Game; option: GuessImportOption }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1.5">
      <span className="text-xs font-extrabold uppercase text-duo-ink">{formatTeamCode(game.first_team.name, game.first_team.code)}</span>
      <FlagImage name={game.first_team.name} code={game.first_team.code} className="h-5 w-7" />
      <span className="min-w-4 text-center text-sm font-extrabold tabular-nums text-duo-ink">{option.guess_first_team}</span>
      <span className="text-xs font-extrabold text-muted">x</span>
      <span className="min-w-4 text-center text-sm font-extrabold tabular-nums text-duo-ink">{option.guess_second_team}</span>
      <FlagImage name={game.second_team.name} code={game.second_team.code} className="h-5 w-7" />
      <span className="text-xs font-extrabold uppercase text-duo-ink">{formatTeamCode(game.second_team.name, game.second_team.code)}</span>
    </span>
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

function RankingPanel({
  pool,
  ranking,
  games,
  viewType,
  onViewTypeChange,
  periodStartDate,
  onPeriodStartDateChange,
  periodEndDate,
  onPeriodEndDateChange,
  now,
  onParticipantClick,
}: {
  pool: Pool;
  ranking: RankingEntry[];
  games: Game[];
  viewType: RankingViewType;
  onViewTypeChange: (type: RankingViewType) => void;
  periodStartDate: string;
  onPeriodStartDateChange: (date: string) => void;
  periodEndDate: string;
  onPeriodEndDateChange: (date: string) => void;
  now: number;
  onParticipantClick?: (participantId: number) => void;
}) {
  const allDates = useMemo(() => {
    const dates = games.map(g => getLocalDateKey(new Date(g.date_game)));
    return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
  }, [games]);

  const defaultStartDate = useMemo(() => allDates[0] ?? "", [allDates]);
  const defaultEndDate = useMemo(() => allDates[allDates.length - 1] ?? "", [allDates]);

  const startDate = periodStartDate || defaultStartDate;
  const endDate = periodEndDate || defaultEndDate;

  const displayRanking = useMemo(() => {
    if (viewType === "general") {
      return ranking;
    }

    if (!startDate || !endDate) {
      return [];
    }

    return calculateRankingByPeriod(ranking, games, startDate, endDate);
  }, [viewType, startDate, endDate, ranking, games]);

  return (
    <div className="space-y-4">
      <div className="duo-card p-5">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => onViewTypeChange("general")}
            className={`px-4 py-2 rounded-duo font-bold transition text-sm ${viewType === "general"
                ? "bg-duo-green text-white"
                : "bg-duo-card border border-duo-border text-duo-ink hover:border-duo-green"
              }`}
          >
            Ranking Geral
          </button>
          <button
            onClick={() => onViewTypeChange("byPeriod")}
            className={`px-4 py-2 rounded-duo font-bold transition text-sm ${viewType === "byPeriod"
                ? "bg-duo-green text-white"
                : "bg-duo-card border border-duo-border text-duo-ink hover:border-duo-green"
              }`}
          >
            Por Período
          </button>
        </div>

        {viewType === "byPeriod" && (
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-duo-muted mb-1">Data Inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onPeriodStartDateChange(e.target.value)}
                max={endDate || undefined}
                className="duo-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-duo-muted mb-1">Data Final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onPeriodEndDateChange(e.target.value)}
                min={startDate || undefined}
                className="duo-input text-sm"
              />
            </div>
          </div>
        )}

        <p className="text-sm text-muted">
          Placar exato: {pool.correct_score} pts · Resultado: {pool.result_score} pt(s)
        </p>
      </div>

      <div className="duo-card p-5">
        {displayRanking.length === 0 ? (
          <p className="text-sm text-muted">Nenhum participante no ranking ainda.</p>
        ) : (
          <ol className="grid gap-2">
            {displayRanking.map((entry) => (
              <li
                key={entry.participant_id}
                onClick={() => onParticipantClick?.(entry.participant_id)}
                role="button"
                tabIndex={0}
                className="cursor-pointer flex items-center justify-between gap-3 rounded-duo border border-duo-border bg-duo-card/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-duo-green/10 text-sm font-extrabold text-duo-greenDark">
                    {entry.position}
                  </span>
                  <span className="font-bold">{entry.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-duo-greenDark">{entry.total_points} pts</p>
                  <p className="text-xs text-muted">{entry.guesses_count} palpite(s)</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function GamesDayPanel({
  dayKey,
  label,
  games,
  drafts,
  onDraftChange,
  onImportGuess,
  onSave,
  saving,
  now,
  emptyMessage = "Nenhum jogo neste dia.",
}: {
  dayKey: string;
  label: string;
  games: Game[];
  drafts: Record<number, GuessDraft>;
  onDraftChange: Dispatch<SetStateAction<Record<number, GuessDraft>>>;
  onImportGuess: (game: Game) => void;
  onSave: () => void;
  saving: boolean;
  now: number;
  emptyMessage?: string;
}) {
  const openGames = games.filter((g) => !isGameClosed(g, now));
  const hasOpenGames = openGames.length > 0;

  return (
    <section className="duo-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold capitalize">{label}</h2>
        <span className="text-xs text-muted">{games.length} partida(s)</span>
      </div>

      {games.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3">
            {games.map((game) =>
              isGameClosed(game, now) ? (
                <ClosedGameCard key={game.id} game={game} />
              ) : (
                <OpenGameCard
                  key={game.id}
                  game={game}
                  draft={drafts[game.id] ?? buildDraftForGame(game)}
                  onDraftChange={onDraftChange}
                  onImportGuess={onImportGuess}
                />
              ),
            )}
          </div>

          {hasOpenGames ? (
            <div className="mt-5 flex justify-end">
              <button
                className="duo-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onSave}
                disabled={saving}
                type="button"
              >
                {saving ? "Salvando..." : "Salvar palpites"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function ClosedGameCard({ game }: { game: Game }) {
  const hasScore = hasOfficialScore(game);
  const hasGuess = game.guessed != null;
  const points = game.guessed?.points_earned;

  return (
    <article className="rounded-duo border border-duo-border bg-duo-border/20 px-4 py-4 opacity-90">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{formatTime(game.date_game)}</span>
        {game.stadium ? (
          <>
            <span>·</span>
            <span>{game.stadium}</span>
          </>
        ) : null}
        {game.round ? (
          <>
            <span>·</span>
            <span>Rodada {game.round}</span>
          </>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <TeamSide name={game.first_team.name} code={game.first_team.code} align="left" />
        <div className="text-center">
          {hasGuess ? (
            <>
              <p className="text-xl font-extrabold tabular-nums">
                {game.guessed!.guess_first_team} x {game.guessed!.guess_second_team}
              </p>
              <p className="mt-0.5 text-xs font-bold text-muted">seu palpite</p>
            </>
          ) : (
            <p className="text-sm text-muted">Sem palpite</p>
          )}
        </div>
        <TeamSide name={game.second_team.name} code={game.second_team.code} align="right" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-duo-border/60 pt-3">
        {hasScore ? (
          <p className="text-xs text-muted">
            Placar final: {game.score_first_team} x {game.score_second_team}
          </p>
        ) : (
          <p className="text-xs text-muted">Resultado ainda não disponível</p>
        )}
        {hasGuess && points != null ? (
          <span className="shrink-0 rounded-full bg-duo-green/10 px-2.5 py-0.5 text-xs font-bold text-duo-greenDark">
            {points} pt(s)
          </span>
        ) : null}
      </div>
    </article>
  );
}

function OpenGameCard({
  game,
  draft,
  onDraftChange,
  onImportGuess,
}: {
  game: Game;
  draft: GuessDraft;
  onDraftChange: Dispatch<SetStateAction<Record<number, GuessDraft>>>;
  onImportGuess: (game: Game) => void;
}) {
  return (
    <article className="border-b border-duo-border bg-duo-card/80 px-4 py-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-extrabold uppercase text-muted">
        <span className="text-left font-extrabold tabular-nums text-duo-ink text-[12px]">Grupo {game.group}</span>
        <span className="truncate text-center">{game.stadium || game.city || "-"}</span>
        <span className="text-right font-extrabold tabular-nums text-duo-ink text-[15px]">{formatTime(game.date_game)}</span>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-1.5">
        <CompactTeamName name={game.first_team.name} code={game.first_team.code} align="right" />
        <FlagImage name={game.first_team.name} code={game.first_team.code} className="h-7 w-9" />
        <GuessInputs gameId={game.id} draft={draft} onDraftChange={onDraftChange} compact />
        <FlagImage name={game.second_team.name} code={game.second_team.code} className="h-7 w-9" />
        <CompactTeamName name={game.second_team.name} code={game.second_team.code} align="left" />
      </div>

      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => onImportGuess(game)}
          className="text-xs font-bold text-duo-greenDark underline-offset-4 transition hover:text-duo-green hover:underline"
        >
          Importar palpite
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted">
        Rodada {game.round ? <span>{game.round}</span> : null}
        {game.stadium && game.city ? <span>·</span> : null}
        {game.city ? <span>{game.city}</span> : null}
      </div>

      <div className="mt-2 text-center text-[11px] font-bold text-muted">
        Palpites encerram às <span className="tabular-nums text-duo-ink">{formatTime(game.date_closing_game)}</span>
      </div>
    </article>
  );
}

function CompactTeamName({ name, code, align }: { name: string; code?: string | null; align: "left" | "right" }) {
  return (
    <span className={`min-w-0 truncate text-base font-semibold leading-none text-duo-ink sm:text-lg ${align === "right" ? "text-right" : "text-left"}`}>
      <span className="sm:hidden">{formatTeamCode(name, code)}</span>
      <span className="hidden sm:inline">{name}</span>
    </span>
  );
}

function TeamSide({ name, code, align }: { name: string; code?: string | null; align: "left" | "right" }) {
  const imgEl = <FlagImage name={name} code={code} className="h-7 w-7" />;

  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
      <span className="min-w-0 text-base font-bold text-duo-ink sm:text-lg">{name}</span>
      {imgEl}
    </div>
  );
}

function FlagImage({ name, code, className }: { name: string; code?: string | null; className: string }) {
  const fifaUrl = code ? `https://api.fifa.com/api/v3/picture/flags-sq-4/${code}` : undefined;
  const [src, setSrc] = useState<string | undefined>(fifaUrl);

  useEffect(() => {
    setSrc(fifaUrl);
  }, [fifaUrl]);

  function handleImgError() {
    setSrc(undefined);
  }

  const imgEl = src ? (
    <img
      src={src}
      alt={name}
      title={name}
      onError={handleImgError}
      className={`${className} shrink-0 object-cover`}
    />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center bg-duo-border text-xs font-bold`}>{formatTeamCode(name, code)}</div>
  );

  return imgEl;
}

function GuessInputs({
  gameId,
  draft,
  onDraftChange,
  compact = false,
}: {
  gameId: number;
  draft: GuessDraft;
  onDraftChange: Dispatch<SetStateAction<Record<number, GuessDraft>>>;
  compact?: boolean;
}) {
  function handleChange(field: "first" | "second", value: string) {
    const sanitized = value.replace(/[^0-9]/g, "");
    onDraftChange((current) => ({
      ...current,
      [gameId]: {
        ...(current[gameId] ?? { first: "", second: "" }),
        [field]: sanitized,
      },
    }));
  }

  return (
    <span className={`inline-flex items-center justify-center ${compact ? "gap-1" : "gap-2"}`}>
      <input
        className={`duo-input duo-score-input px-2 font-extrabold ${compact ? "h-8 w-8 rounded-sm text-base" : "h-11 w-14 text-lg"}`}
        type="number"
        min={0}
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft.first}
        onChange={(event) => handleChange("first", event.target.value)}
        aria-label={`Palpite do primeiro time no jogo ${gameId}`}
      />
      <span className={`${compact ? "text-sm" : "text-base"} font-extrabold text-muted`}>x</span>
      <input
        className={`duo-input duo-score-input px-2 font-extrabold ${compact ? "h-8 w-8 rounded-sm text-base" : "h-11 w-14 text-lg"}`}
        type="number"
        min={0}
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft.second}
        onChange={(event) => handleChange("second", event.target.value)}
        aria-label={`Palpite do segundo time no jogo ${gameId}`}
      />
    </span>
  );
}

function isGameClosed(game: Game, now: number) {
  const closingTime = getEffectiveClosingTime(game);
  return Number.isFinite(closingTime) ? now >= closingTime : true;
}

function hasOfficialScore(game: Game) {
  return game.score_first_team != null && game.score_first_team !== "" && game.score_second_team != null && game.score_second_team !== "";
}

function getEffectiveClosingTime(game: Game) {
  const gameDateKey = getLocalDateKey(new Date(game.date_game));
  const closingTimeParts = getTimePartsInAppTimeZone(new Date(game.date_closing_game));

  return new Date(`${gameDateKey}T${closingTimeParts.hour}:${closingTimeParts.minute}:00-03:00`).getTime();
}

function getTimePartsInAppTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    hour: parts.find((part) => part.type === "hour")?.value ?? "00",
    minute: parts.find((part) => part.type === "minute")?.value ?? "00",
  };
}

function buildDraftForGame(game: Game): GuessDraft {
  return {
    first: game.guessed?.guess_first_team ?? "",
    second: game.guessed?.guess_second_team ?? "",
  };
}

function buildDrafts(games: Game[]) {
  return games.reduce<Record<number, GuessDraft>>((accumulator, game) => {
    accumulator[game.id] = buildDraftForGame(game);
    return accumulator;
  }, {});
}

function compareGamesByDate(a: Game, b: Game) {
  const timeA = new Date(a.date_game).getTime();
  const timeB = new Date(b.date_game).getTime();

  if (timeA !== timeB) return timeA - timeB;
  return a.id - b.id;
}

function groupGamesByDay(games: Game[]) {
  return games.slice().sort(compareGamesByDate).reduce<Map<string, Game[]>>((accumulator, game) => {
    const key = getLocalDateKey(new Date(game.date_game));
    const current = accumulator.get(key) ?? [];
    accumulator.set(key, [...current, game]);
    return accumulator;
  }, new Map<string, Game[]>());
}

function getLocalDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date, includeTodayLabel: boolean) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);

  if (!includeTodayLabel) {
    return label;
  }

  return `Hoje · ${label}`;
}

function formatCompactDateLabel(value: string) {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, weekday: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const key = getLocalDateKey(date);
  const [year, month, day] = key.split("-");

  return `${weekday} ${day}/${month}/${year}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTeamCode(name: string, code?: string | null) {
  if (code === "KOR") return "COR";
  if (code === "CZE") return "TCH";
  if (code === "ZAF" || name.toLowerCase().includes("áfrica do sul")) return "AFS";
  if (code) return code.slice(0, 3).toUpperCase();

  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function calculateRankingByPeriod(
  ranking: RankingEntry[],
  games: Game[],
  startDate: string,
  endDate: string
): RankingEntry[] {
  const pointsByParticipant = new Map<number, number>();
  const guessesCountByParticipant = new Map<number, number>();

  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T23:59:59`).getTime();

  for (const game of games) {
    const gameDate = new Date(game.date_game).getTime();

    if (gameDate < start || gameDate > end) {
      continue;
    }

    if (!game.guessed) continue;

    const participantId = game.guessed.participant.participant_id;
    const currentPoints = pointsByParticipant.get(participantId) ?? 0;
    const earnedPoints = game.guessed.points_earned ?? 0;
    const currentGuesses = guessesCountByParticipant.get(participantId) ?? 0;

    pointsByParticipant.set(participantId, currentPoints + earnedPoints);
    guessesCountByParticipant.set(participantId, currentGuesses + 1);
  }

  const periodRanking = ranking
    .map((entry) => ({
      ...entry,
      total_points: pointsByParticipant.get(entry.participant_id) ?? 0,
      guesses_count: guessesCountByParticipant.get(entry.participant_id) ?? 0,
    }))
    .sort((a, b) => b.total_points - a.total_points)
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

  return periodRanking;
}

