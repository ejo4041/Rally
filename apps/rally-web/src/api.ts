import { synchronizeClock } from "./clock.ts";
import { APIError } from "./api-types.ts";
export * from "./api-types.ts";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const sent = performance.now();
  const response = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const time = response.headers.get("X-Rally-Time");
  if (time) synchronizeClock(Number(time), sent, performance.now());
  if (response.status === 204) return undefined as T;
  const value = await response.json().catch(() => ({
    error:
      "Unexpected response from Rally. Please refresh the record before retrying.",
  }));
  if (
    response.status === 401 &&
    !path.startsWith("/auth/") &&
    typeof window !== "undefined"
  )
    window.dispatchEvent(new Event("rally:session-expired"));
  if (!response.ok)
    throw new APIError(value.error || "The request failed.", response.status);
  return value as T;
}
