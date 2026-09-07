// VITE_API_URL points to the remote API origin (e.g. "https://your-api.replit.dev")
// If not set, use relative path based on BASE_URL (for same-origin deployments)
const _apiOrigin = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const BASE_URL = _apiOrigin ? `${_apiOrigin}/api` : `${import.meta.env.BASE}api`;

export interface Annotation {
  id: number;
  title: string;
  content: string;
  type: "text" | "highlight" | "drawing" | "link";
  color: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceApp: string | null;
  sourceWindowTitle: string | null;
  localFilePath: string | null;
  osTagsSynced: boolean;
  isPinned: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnotationBody {
  title: string;
  content: string;
  type: "text" | "highlight" | "drawing" | "link";
  color?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceApp?: string | null;
  sourceWindowTitle?: string | null;
  localFilePath?: string | null;
  osTagsSynced?: boolean;
  tags?: string[];
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  annotations: {
    list: (params?: { limit?: number }) =>
      apiFetch<Annotation[]>(`/annotations/recent?limit=${params?.limit ?? 8}`),

    create: (body: CreateAnnotationBody) =>
      apiFetch<Annotation>("/annotations", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    stats: () => apiFetch<{ total: number; pinned: number }>("/annotations/stats"),
  },
};
