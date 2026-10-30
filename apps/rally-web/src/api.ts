import { synchronizeClock } from "./clock.ts";
import type {
  Meeting,
  Turn,
  Plan,
  Report,
} from "../../rally-api/src/contracts.ts";
export type { Meeting, Turn, Plan, Report };
export type RecordView = Meeting & { turns: Turn[] };
export type User = { id: string; username: string; role?: string };
export type Summary = Pick<
  Meeting,
  "id" | "title" | "createdAt" | "phase" | "reportStatus"
>;
export type Connection = {
  captureToken?: string;
  url: string;
  token: string;
  room: string;
};
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
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
