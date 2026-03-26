import type { EnemyFormationUnit, ActionLink, DirectedAction, FloatingTextItem } from "@/components/battle/useBattlePresentation";
import { BattleAnnouncement } from "@/components/battle/BattleAnnouncement";
import { BattleEffectLayer } from "@/components/battle/BattleEffectLayer";
import { EnemyFormation } from "@/components/battle/EnemyFormation";
import { PlayerActorCard } from "@/components/battle/PlayerActorCard";

interface BattlefieldStageProps {
  player: {
    name: string;
    hpCurrent: number;
    hpMax: number;
    shieldCurrent: number;
    shieldMax: number;
    energyCurrent: number;
    energyMax: number;
    statuses: string[];
    extraStatusCount: number;
  };
  enemyUnits: EnemyFormationUnit[];
  activeAction: DirectedAction;
  actionLinks: ActionLink[];
  floatingTexts: FloatingTextItem[];
}

export function BattlefieldStage(props: BattlefieldStageProps): JSX.Element {
  const { player, enemyUnits, activeAction, actionLinks, floatingTexts } = props;

  return (
    <div className="relative h-[460px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_48%,rgba(30,41,59,0.4),rgba(2,6,23,0.9))]">
      <div className="absolute inset-x-0 top-0 h-[38%] bg-[linear-gradient(180deg,rgba(59,130,246,0.07),rgba(2,6,23,0))]" />
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,rgba(2,6,23,0),rgba(2,6,23,0.65))]" />

      <BattleAnnouncement
        action={activeAction.title}
        actor={activeAction.actorLabel}
        target={activeAction.targetLabel}
        tags={activeAction.tags}
        summary={activeAction.summary}
        burstHighlight={activeAction.kind === "burst"}
      />

      <BattleEffectLayer links={actionLinks} floatingTexts={floatingTexts} />

      <div className="absolute left-[7%] top-[53%] w-[32%] -translate-y-1/2">
        <PlayerActorCard
          name={player.name}
          hpCurrent={player.hpCurrent}
          hpMax={player.hpMax}
          shieldCurrent={player.shieldCurrent}
          shieldMax={player.shieldMax}
          energyCurrent={player.energyCurrent}
          energyMax={player.energyMax}
          statuses={player.statuses}
          extraStatusCount={player.extraStatusCount}
          acting={activeAction.actorSide === "player"}
          targeted={activeAction.targetSide === "player"}
        />
      </div>

      <EnemyFormation units={enemyUnits} />
    </div>
  );
}

