export interface GameState {
  phase: "lobby" | "day" | "night";
  players: Player[];
  votes: Record<string, string>;
  dayCount: number;
  gameStarted: boolean;
}

export interface Player {
  id: string;
  name: string;
  isAlive: boolean;
  role?: string;
}

export interface GameAction {
  type: string;
  payload?: any;
} 
