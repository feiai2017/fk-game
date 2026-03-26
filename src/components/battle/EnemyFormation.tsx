import type { EnemyFormationUnit } from "@/components/battle/useBattlePresentation";
import { EnemyActorCard } from "@/components/battle/EnemyActorCard";

export function EnemyFormation({ units }: { units: EnemyFormationUnit[] }): JSX.Element {
  return (
    <div className="absolute inset-0">
      {units.map((unit) => (
        <EnemyActorCard key={unit.key} unit={unit} />
      ))}
    </div>
  );
}

