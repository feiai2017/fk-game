import { generateTowerFloors } from "@/core/tower/towerGenerator";
import { TOTAL_TOWER_FLOORS } from "@/data/constants";

export const TOWER_FLOORS = generateTowerFloors(TOTAL_TOWER_FLOORS);

