import { createContext, ReactNode, useContext, useEffect, useState, useMemo } from "react";

type GameMode = "landing" | "waiting" | "night" | "day";

interface Player {
	id: string;
	name: string;
	role?: string;
	isAlive: boolean;
	isCreator?: boolean;
}

interface GameState {
	gameProcess: string;
	currentPhase: string;
	currentRound: number;
	currentTimestamp: number;
}

interface GameContextType {
	mode: GameMode;
	setMode: (newState: GameMode) => void;
	currentPlayer: Player | null;
	setCurrentPlayer: (player: Player | null) => void;
	joinedPlayers: Player[];
	setJoinedPlayers: (players: Player[]) => void;
	gameState: GameState;
	setGamestate: (gamestate: GameState) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
	const [mode, setMode] = useState<GameMode>("landing");
	const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
	const [joinedPlayers, setJoinedPlayers] = useState<Player[]>([]);
	const [gameState, setGamestate] = useState<GameState>({
		gameProcess: "3KCI673j46LliB_7VBBfBOxbZsaoxU0Q8dbzLcItXRk",
		currentPhase: "lobby",
		currentRound: 0,
		currentTimestamp: 0,
	});

	const contextValue = useMemo(
		() => ({
			mode,
			setMode,
			currentPlayer,
			setCurrentPlayer,
			joinedPlayers,
			setJoinedPlayers,
			gameState,
			setGamestate,
		}),
		[mode, currentPlayer, joinedPlayers, gameState]
	);

	useEffect(() => {
		console.log("Mode changed:", mode);
	}, [mode]);

	useEffect(() => {
		console.log("Current player changed:", currentPlayer);
	}, [currentPlayer]);

	return (
		<GameContext.Provider value={contextValue}>
			{children}
		</GameContext.Provider>
	);
};

export const useGameContext = () => {
	const context = useContext(GameContext);
	if (!context) {
		throw new Error("useGameContext must be used within a GameProvider");
	}
	return context;
};
