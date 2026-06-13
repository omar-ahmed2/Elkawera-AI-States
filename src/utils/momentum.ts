import { MatchEvent } from "../types";

export interface MomentumPoint {
  minute: number;
  val: number; // Positive for Team A, Negative for Team B
  description: string;
}

/**
 * Calculates a minute-by-minute match momentum curve from events list.
 */
export function calculateMatchMomentum(events: MatchEvent[]): MomentumPoint[] {
  // If no events, return a flat baseline
  if (!events || events.length === 0) {
    return [
      { minute: 0, val: 0, description: "بداية اللقاء" },
      { minute: 15, val: 0, description: "هدوء نسبي" },
      { minute: 30, val: 0, description: "هدوء نسبي" },
      { minute: 45, val: 0, description: "هدوء نسبي" },
    ];
  }

  // Helper to extract minutes
  const parseMinute = (timestamp: string): number => {
    if (!timestamp) return 0;
    const parts = timestamp.split(":");
    if (parts.length === 1) return parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[0], 10);
    return isNaN(mins) ? 0 : mins;
  };

  const points: { [min: number]: { sum: number; desc: string[] } } = {};

  events.forEach(ev => {
    const min = parseMinute(ev.timestamp);
    let val = 0;
    
    if (ev.updates) {
      ev.updates.forEach(u => {
        let weight = 0;
        if (u.stat === "goals") weight = 10;
        else if (u.stat === "assists") weight = 6;
        else if (u.stat === "penalty_saves") weight = 8;
        else if (u.stat === "normal_saves") weight = 4;
        else if (u.stat === "def_con") weight = 3;
        else if (u.stat === "own_goal") weight = -10;
        else if (u.stat === "penalty_miss") weight = -8;
        else if (u.stat === "goal_cons") weight = -2;

        // Positive for A, Negative for B
        if (u.team === "A") {
          val += weight;
        } else {
          val -= weight;
        }
      });
    }

    if (!points[min]) {
      points[min] = { sum: 0, desc: [] };
    }
    points[min].sum += val;
    points[min].desc.push(ev.explanation);
  });

  // Convert map to sorted list
  const sortedMinutes = Object.keys(points)
    .map(Number)
    .sort((a, b) => a - b);

  const result: MomentumPoint[] = [];
  
  // Starting point
  result.push({ minute: 0, val: 0, description: "انطلاق المباراة" });

  let cumulative = 0;
  sortedMinutes.forEach(m => {
    // We add some decay to older events, but major events have persistent momentum
    cumulative = cumulative * 0.4 + points[m].sum;
    result.push({
      minute: m + 1, // subtle offset for display
      val: cumulative,
      description: points[m].desc.join(" | ")
    });
  });

  // Ensure last point is plotted
  const maxMin = sortedMinutes.length > 0 ? sortedMinutes[sortedMinutes.length - 1] : 45;
  if (maxMin < 45) {
    result.push({ minute: 45, val: 0, description: "نهاية الشوط" });
  }

  return result;
}
