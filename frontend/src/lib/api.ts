import { formatApiMessage } from "@/lib/messages";

type ApiClientOptions = {
  baseUrl?: string;
  token?: string | null;
};

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function api({ baseUrl, token }: ApiClientOptions) {
  const resolvedBaseUrl = (baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Token ${token}`;

    const res = await fetch(`${resolvedBaseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    const parsed = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      const body = parsed as { message?: string; detail?: string };
      const raw =
        typeof body?.message === "string"
          ? body.message
          : typeof body?.detail === "string"
            ? body.detail
            : "Erro na API";
      throw new ApiError(formatApiMessage(raw), res.status, parsed);
    }
    return parsed as T;
  }

  return {
    get: <T,>(path: string) => request<T>("GET", path),
    post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
    patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

