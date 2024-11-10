export enum GamePhase {
  Lobby = "lobby",
  Day = "day",
  Night = "night",
  Ended = "ended",
}

export enum UIState {
  Landing = "landing",
  Waiting = "waiting",
  Night = "night",
  Day = "day",
}

export type PlayerRole = "werewolf" | "villager" | "seer" | "doctor";

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

export const phaseToUIState = (phase: GamePhase): UIState => {
  switch (phase) {
    case GamePhase.Lobby:
      return UIState.Waiting;
    case GamePhase.Night:
      return UIState.Night;
    case GamePhase.Day:
      return UIState.Day;
    case GamePhase.Ended:
      return UIState.Landing; // Adjust as needed
    default:
      return UIState.Landing;
  }
};
