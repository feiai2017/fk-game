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
    summary: "通过叠加持续伤害并在窗口期引爆，逐步拉高输出。",
    strengths: ["持续输出成长高", "长战压制能力强"],
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
