import { WaitingRoom } from "./WaitingRoom";
import { LandingPage } from "./LandingPage";
import { GameRound } from "./GameRound";
import { useGameContext } from "../context/GameContext";

export const Game = () => {
    const { mode } = useGameContext();

    switch (mode) {
        case "landing":
            return <LandingPage />;
        case "waiting":
            return <WaitingRoom />;
        case "night":
        case "day":
            return <GameRound />;
        default:
            return <LandingPage />;
    }
}; 
