import { DateTime } from "luxon";

export function normalizeTz(tz: string | undefined): string {
  if (!tz) return "UTC";
  const trimmed = String(tz).trim();
  if (!trimmed) return "UTC";
  if (trimmed.toUpperCase() === "AOE") return "Etc/GMT+12";
  return trimmed;
}

export function parseLocalToUtcIso(
  local: string,
  tz: string
): { isoUtc: string; dtUtc: DateTime } {
  // Accept "YYYY-MM-DD HH:mm" or ISO strings.
  const s = local.trim();
  const dt =
    s.includes("T") || s.endsWith("Z")
      ? DateTime.fromISO(s, { setZone: true })
      : DateTime.fromFormat(s, "yyyy-MM-dd HH:mm", { zone: tz });

  if (!dt.isValid) {
    throw new Error(`Invalid deadline datetime: "${local}" (tz: "${tz}")`);
  }
  const dtUtc = dt.toUTC();
  return { isoUtc: dtUtc.toISO({ suppressMilliseconds: true })!, dtUtc };
}

export function humanizeCountdown(nowUtc: DateTime, deadlineUtc: DateTime): {
  label: string;
  state: "past" | "soon" | "ok";
} {
  const diff = deadlineUtc.diff(nowUtc, ["days", "hours", "minutes"]).toObject();
  const totalMinutes = Math.round(deadlineUtc.diff(nowUtc, "minutes").minutes);
  if (totalMinutes <= 0) return { label: "PAST", state: "past" };

  const days = Math.floor((diff.days ?? 0) as number);
  const hours = Math.floor((diff.hours ?? 0) as number);
  const minutes = Math.floor((diff.minutes ?? 0) as number);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);

  const label = parts.join(" ") || "<1m";
  const state = totalMinutes <= 24 * 60 * 7 ? "soon" : "ok";
  return { label, state };
}

