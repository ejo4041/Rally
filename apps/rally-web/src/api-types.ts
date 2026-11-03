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
