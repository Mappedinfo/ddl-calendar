import yaml from "js-yaml";
import type { DeadlinesYaml, NormalizedItem } from "./types";
import { normalizeTz, parseLocalToUtcIso } from "./time";

export async function loadYaml(path = "deadlines.yaml"): Promise<{
  site: DeadlinesYaml["site"];
  items: NormalizedItem[];
}> {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const doc = yaml.load(text) as DeadlinesYaml;
  const rawItems = doc?.items ?? [];

  const items: NormalizedItem[] = rawItems.map((it, idx) => {
    if (!it || !it.title || !it.deadline) {
      throw new Error(`Invalid item at index ${idx}: need title + deadline`);
    }
    const tz = normalizeTz(it.timezone ?? doc?.site?.timezone ?? "UTC");
    const { isoUtc } = parseLocalToUtcIso(it.deadline, tz);
    return {
      ...it,
      id: (it.id && String(it.id)) || `${slug(it.acronym || it.venue || it.title)}-${idx}`,
      venue: it.venue?.trim() || it.acronym?.trim() || "Unknown",
      tags: Array.isArray(it.tags) ? it.tags.map(String) : [],
      timezone: tz,
      deadlineIsoUtc: isoUtc,
    };
  });

  // Sort by deadline ascending
  items.sort((a, b) => a.deadlineIsoUtc.localeCompare(b.deadlineIsoUtc));
  return { site: doc?.site, items };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

