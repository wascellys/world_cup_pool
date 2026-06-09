"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from "react-icons/fa";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setToasts((current) => [...current, { id, type, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message) => showToast(message, "success"),
      error: (message) => showToast(message, "error"),
      info: (message) => showToast(message, "info"),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const styles = {
    success: {
      icon: FaCheckCircle,
      bar: "bg-emerald-500",
      ring: "ring-emerald-500/20",
    },
    error: {
      icon: FaExclamationCircle,
      bar: "bg-red-500",
      ring: "ring-red-500/20",
    },
    info: {
      icon: FaInfoCircle,
      bar: "bg-sky-500",
      ring: "ring-sky-500/20",
    },
  }[toast.type];

  const Icon = styles.icon;

  return (
    <div
      className={[
        "pointer-events-auto toast-enter flex items-start gap-3 overflow-hidden rounded-2xl border border-duo-border bg-duo-card p-4 shadow-lg ring-1",
        styles.ring,
      ].join(" ")}
      role="alert"
    >
      <div className={`mt-0.5 h-full w-1 shrink-0 self-stretch rounded-full ${styles.bar}`} />
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-duo-ink" aria-hidden />
      <p className="flex-1 text-sm font-semibold leading-snug text-duo-ink">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-duo-muted transition hover:bg-duo-border/40 hover:text-duo-ink"
        aria-label="Fechar alerta"
      >
        <FaTimes className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
