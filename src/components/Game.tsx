import { WaitingRoom } from "./WaitingRoom";
import { LandingPage } from "./LandingPage";
import { GameRound } from "./GameRound";
import { useGameContext } from "../context/GameContext";
import { UIState } from "@/types/game";

export const Game = () => {
    const { mode } = useGameContext();

    switch (mode) {
        case UIState.Landing:
            return <LandingPage />;
        case UIState.Waiting:
            return <WaitingRoom />;
        case UIState.Night:
        case UIState.Day:
            return <GameRound />;
        default:
            return <LandingPage />;
    }
}; 
