export interface PlayerStats {
  goals: number;
  assists: number;
  def_con: number;
  normal_saves: number;
  penalty_saves: number;
  penalty_miss: number;
  own_goal: number;
  goal_cons: number;
}

export interface Player {
  id: string;
  name: string;
  stats: PlayerStats;
}

export interface MatchEvent {
  id: string;
  timestamp: string; // MM:SS or HH:MM:SS format corresponding to match timer
  transcription: string; // The Arabic transcription parsed by AI
  explanation: string; // Readable text describing the event (e.g., "عمر سجل هدفاً بمساعدة أحمد")
  rawText?: string;
  updates: {
    playerId: string;
    playerName: string;
    stat: keyof PlayerStats;
    change: number;
    team: 'A' | 'B';
  }[];
}

export interface MatchState {
  teamName: string;
  players: Player[];
  status: 'setup' | 'active' | 'finished';
  events: MatchEvent[];
  startedAt: number | null; // Timestamp
  duration: number; // in seconds
}

export const initialStats = (): PlayerStats => ({
  goals: 0,
  assists: 0,
  def_con: 0,
  normal_saves: 0,
  penalty_saves: 0,
  penalty_miss: 0,
  own_goal: 0,
  goal_cons: 0,
});

export interface MatchHistoryItem {
  id: string;
  date: string;
  teamNameA: string;
  teamNameB: string;
  scoreA: number;
  scoreB: number;
  duration: number;
  mvp: { name: string; teamName: string; score: number } | null;
  playersA: Player[];
  playersB: Player[];
  eventsCount: number;
  aiInsightsSummary?: any; // Storing the structured summaries
  events?: MatchEvent[];
}

export interface GroupTeam {
  id: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupMatch {
  id: string;
  teamAId: string;
  teamBId: string;
  scoreA?: number | null;
  scoreB?: number | null;
  played: boolean;
}

export interface TournamentGroup {
  id: string; // 'A' | 'B' | 'C' | 'D'
  name: string;
  teams: GroupTeam[];
  matches: GroupMatch[];
}


