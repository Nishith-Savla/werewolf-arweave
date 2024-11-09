export type GamePhase = 'lobby' | 'day' | 'night';
export type PlayerRole = 'werewolf' | 'villager' | 'seer' | 'doctor';

export interface Player {
  id: string;
  name: string;
  role?: PlayerRole;
  isAlive: boolean;
  isCreator: boolean;
}

export interface GameState {
  gameProcess: string;
  phase: GamePhase;
  currentRound: number;
  currentTimestamp: number;
}

export interface GameAction {
  type: string;
  payload?: any;
} 
