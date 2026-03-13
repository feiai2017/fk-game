import type { DamageEntry } from "@/core/battle/types";

export function mergeDamageEntries(entries: DamageEntry[]): DamageEntry[] {
  const merged = new Map<string, DamageEntry>();
  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.category}`;
    const current = merged.get(key);
    if (current) {
      current.total += entry.total;
    } else {
      merged.set(key, { ...entry });
    }
  }
  return [...merged.values()].sort((a, b) => b.total - a.total);
}

export function ratio(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return part / total;
}

