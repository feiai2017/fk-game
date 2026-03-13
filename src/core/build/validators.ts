import type { Loadout } from "@/core/battle/types";

export function validateLoadout(loadout: Loadout): string[] {
  const issues: string[] = [];
  const configuredSkills = loadout.skillIds.filter(Boolean);
  if (configuredSkills.length !== 3) {
    issues.push("请配置完整的 3 个主动技能。");
  }
  if (!loadout.weapon) {
    issues.push("武器槽位为空。");
  }
  if (!loadout.core) {
    issues.push("核心遗物槽位为空。");
  }
  return issues;
}
