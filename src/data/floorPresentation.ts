import type { BossPresentation, EnemyTemplateKey, TowerPressureTag } from "@/core/battle/types";

export interface EnemyPresentationMeta {
  name: string;
  tags: string[];
  description: string;
}

export interface FloorPresentationMeta {
  name: string;
  subtitle: string;
  dangerHint: string;
}

export const ENEMY_PRESENTATION_META: Record<EnemyTemplateKey, EnemyPresentationMeta> = {
  fast: {
    name: "收割者",
    tags: ["快攻", "高爆发", "低耐久"],
    description: "攻击频率很高，前期压血很快，必须尽早减员。",
  },
  tank: {
    name: "盾卫",
    tags: ["高耐久", "高防御", "低伤害"],
    description: "难以快速击杀，会拖慢首杀并拉长承伤时间。",
  },
  balanced: {
    name: "哨兵",
    tags: ["均衡", "稳定输出"],
    description: "没有明显短板，会持续提供稳定压力。",
  },
  antiDot: {
    name: "净蚀祭司",
    tags: ["反DOT", "周期净化"],
    description: "会周期性清除DOT层数，克制持续伤害构筑。",
  },
  boss: {
    name: "试炼首领",
    tags: ["首领", "阶段机制"],
    description: "拥有阶段机制，战斗节奏与普通怪明显不同。",
  },
};

export const FLOOR_PRESENTATION_META: Partial<Record<number, FloorPresentationMeta>> = {
  1: {
    name: "腐化苗圃",
    subtitle: "基础试炼层，验证循环是否成型。",
    dangerHint: "若前10秒输出断档，后续会持续掉血。",
  },
  2: {
    name: "灰烬回廊",
    subtitle: "敌方节奏提升，要求更稳定的普攻与技能衔接。",
    dangerHint: "资源断档会被持续平A拖垮。",
  },
  3: {
    name: "静电试炼场",
    subtitle: "多目标压力开始出现，考验首杀速度。",
    dangerHint: "首杀越慢，承伤曲线越陡。",
  },
  4: {
    name: "裂隙堆场",
    subtitle: "中段清场验证层。",
    dangerHint: "只打前排会导致后排持续叠压。",
  },
  5: {
    name: "孢潮核心",
    subtitle: "首个首领层，进入阶段机制试炼。",
    dangerHint: "首领半血后会重置部分优势，留技能应对阶段切换。",
  },
  6: {
    name: "锈蚀工坊",
    subtitle: "重回多单位场景，验证通关后的续航。",
    dangerHint: "如果靠一次爆发过关，下一层很容易崩。",
  },
  7: {
    name: "孢群前哨",
    subtitle: "当前卡层：重点考验首杀与前期减员。",
    dangerHint: "8~18秒拿不到首杀时，群体压力会快速失控。",
  },
  8: {
    name: "断流走廊",
    subtitle: "资源节奏测试层。",
    dangerHint: "溢出或缺能都会直接转化为输出损失。",
  },
  9: {
    name: "黑潮栈桥",
    subtitle: "中后段单体压血测试。",
    dangerHint: "不能在后1/3战斗完成收尾会被反压。",
  },
  10: {
    name: "零域主控室",
    subtitle: "短流程终点首领层。",
    dangerHint: "首领机制叠加时，错误窗口会被迅速放大。",
  },
};

export const BOSS_PRESENTATION_META: Partial<Record<number, BossPresentation>> = {
  5: {
    name: "孢潮母体",
    passive: "半血阶段会净化DOT并显著提高攻击频率。",
    skills: ["腐化爆震：对玩家造成重击", "狂怒打击：后半段高频攻击"],
    phaseTrigger: "生命低于50%时净化DOT并进入狂怒。",
    dangerTip: "阶段切换后压力骤增，需预留防御或爆发技能。",
  },
  10: {
    name: "零域监视者",
    passive: "进入后半段后会持续保持高压攻击节奏。",
    skills: ["相位重击：高单次伤害", "狂怒连段：短间隔连续压血"],
    phaseTrigger: "生命低于50%时净化DOT并进入高频攻击阶段。",
    dangerTip: "为后半段保留关键技能，不要在前半段过早空转。",
  },
};

export function fallbackFloorPresentation(floor: number, pressure: TowerPressureTag): FloorPresentationMeta {
  const pressureLabel =
    pressure === "swarm"
      ? "群体压制"
      : pressure === "burst"
        ? "爆发压力"
        : pressure === "single"
          ? "单体收尾"
          : pressure === "sustain"
            ? "续航验证"
            : pressure === "antiMechanic"
              ? "反制机制"
              : "基础循环";

  return {
    name: `试炼层 ${floor}`,
    subtitle: `${pressureLabel}主题层，建议根据本层压力调整构筑。`,
    dangerHint: "优先观察首杀时间、承伤峰值与资源稳定性。",
  };
}

export function fallbackBossPresentation(floor: number): BossPresentation {
  return {
    name: `首领 ${floor}`,
    passive: "拥有阶段型机制并会在后半段提高压制力。",
    skills: ["重击：造成高额单次伤害", "护甲姿态：短时提高生存"],
    phaseTrigger: "生命低于50%后触发机制强化。",
    dangerTip: "预留关键技能到阶段切换后使用，避免被反打。",
  };
}
