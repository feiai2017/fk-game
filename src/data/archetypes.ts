import type { ArchetypeKey } from "@/core/battle/types";

export interface ArchetypeDef {
  key: ArchetypeKey;
  name: string;
  summary: string;
  strengths: string[];
}

export const ARCHETYPES: ArchetypeDef[] = [
  {
    key: "dot",
    name: "持续蚀伤",
    summary: "先铺DOT压低群体血线，再用转化技能收割首杀并滚起循环。",
    strengths: ["多目标早期压血稳定", "DOT转化收割能力强"],
  },
  {
    key: "crit",
    name: "暴击强袭",
    summary: "依靠高暴击率与暴伤倍率，在短时间打出高额直伤。",
    strengths: ["清怪速度快", "爆发窗口强"],
  },
  {
    key: "engine",
    name: "资源引擎",
    summary: "围绕消耗与返还能量触发额外伤害，并维持循环稳定。",
    strengths: ["输出曲线平滑", "攻防一体"],
  },
];
