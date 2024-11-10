import { GamePhase, GameState as GameTypeState, PlayerRole, UIState } from "@/types/game";
import {
	createContext,
	Dispatch,
	ReactNode,
	SetStateAction,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type GameMode = UIState;

export interface Player {
	id: string;
	name: string;
	role?: PlayerRole;
	isAlive: boolean;
	isCreator: boolean;
}

interface GameContextType {
	mode: GameMode;
	setMode: Dispatch<SetStateAction<GameMode>>;
	currentPlayer: Player | null;
	setCurrentPlayer: Dispatch<SetStateAction<Player | null>>;
	joinedPlayers: Player[];
	setJoinedPlayers: Dispatch<SetStateAction<Player[]>>;
	gameState: GameTypeState;
	setGamestate: Dispatch<SetStateAction<GameTypeState>>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
	const [mode, setMode] = useState<GameMode>(UIState.Landing);
	const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
	const [joinedPlayers, setJoinedPlayers] = useState<Player[]>([]);
	const [gameState, setGamestate] = useState<GameTypeState>({
		gameProcess: "hvWU6L4AzaP5zy_5syA6Hn2IHEgzQdimUZSsEmkHheY",
		phase: GamePhase.Lobby,
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
