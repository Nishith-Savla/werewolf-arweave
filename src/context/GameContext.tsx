import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

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
	phase: string;
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
	const [gameState, setGamestate] = useState<any>({
		gameProcess: "hvWU6L4AzaP5zy_5syA6Hn2IHEgzQdimUZSsEmkHheY",
		phase: "lobby",
		currentRound: 0,
		currentTimestamp: 0,
	});

	useEffect(() => {
		console.log("GameContext state updated:", {
			mode,
			currentPlayer,
			gameState,
			joinedPlayers,
		});
	}, [mode, currentPlayer, gameState, joinedPlayers]);

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

	return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
};

export const useGameContext = () => {
	const context = useContext(GameContext);
	if (!context) {
		throw new Error("useGameContext must be used within a GameProvider");
	}
	return context;
};
