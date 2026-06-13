import { Player, PlayerStats } from "../types";

/**
 * Calculates a live SofaScore/FotMob style rating for a player based on their stats.
 * Base rating starts at 6.0 and goes up/down according to actions.
 * Minimum rating is 3.0, maximum is 10.0.
 */
export function calculatePlayerLiveRating(player: Player, isGoalkeeper: boolean = false): number {
  if (!player || !player.stats) return 6.0;

  const {
    goals = 0,
    assists = 0,
    def_con = 0,
    normal_saves = 0,
    penalty_saves = 0,
    penalty_miss = 0,
    own_goal = 0,
    goal_cons = 0
  } = player.stats;

  let rating = 6.0;

  // Attack points
  rating += goals * 1.5;
  rating += assists * 1.0;

  // Defensive contributions (interceptions, tackles, blocks)
  rating += def_con * 0.4;

  // Goalkeeping stats
  rating += normal_saves * 0.5;
  rating += penalty_saves * 1.2;
  rating -= goal_cons * 0.3;

  // Infractions and mistakes
  rating -= penalty_miss * 1.2;
  rating -= own_goal * 1.5;

  // Capping the rating between 3.0 and 10.0
  const finalRating = Math.max(3.0, Math.min(10.0, rating));
  
  // Return rounded to 1 decimal place
  return Math.round(finalRating * 10) / 10;
}

/**
 * Determines the visual badge color for a rating.
 */
export function getRatingColorClass(rating: number): { text: string; bg: string; border: string } {
  if (rating >= 8.5) {
    return {
      text: "text-emerald-400 font-extrabold",
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/30"
    };
  }
  if (rating >= 7.0) {
    return {
      text: "text-green-400 font-bold",
      bg: "bg-green-500/10",
      border: "border-green-500/20"
    };
  }
  if (rating >= 6.0) {
    return {
      text: "text-neutral-300",
      bg: "bg-neutral-900",
      border: "border-neutral-850"
    };
  }
  return {
    text: "text-red-400 font-bold",
    bg: "bg-red-500/10",
    border: "border-red-500/20"
  };
}
