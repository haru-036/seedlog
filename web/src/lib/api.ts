export const API_BASE = "https://seedlog-api.harurahu.workers.dev";

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
}

export async function fetcher<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 401) {
    window.location.replace("/");
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
