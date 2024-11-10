import { useEffect, useState } from "react";
import { useGameContext } from "../context/GameContext";
import { dryrunResult } from "../lib/utils";
import { Player } from "../types/game";
import "./GameBoard.css";
import PlayerList from "./PlayerList";

interface GameBoardProps {
	currentPlayer: Player;
}

export default function GameBoard({ currentPlayer }: GameBoardProps) {
	const { gameState, setGamestate } = useGameContext();
	const [players, setPlayers] = useState<Player[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchGameData = async () => {
			try {
				// Fetch game state
				const state = await dryrunResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Game-State",
					},
				]);

				// Fetch players
				const playerList = await dryrunResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Players",
					},
				]);

				if (Array.isArray(playerList)) {
					setPlayers(playerList);
				}

				setGamestate((prevState) => ({
					...prevState,
					...state,
				}));
			} catch (error) {
				console.error("Error fetching game data:", error);
			} finally {
				setIsLoading(false);
			}
		};

		const interval = setInterval(fetchGameData, 5000);
		return () => clearInterval(interval);
	}, [gameState.gameProcess, setGamestate]);

	if (isLoading) {
		return <div>Loading game state...</div>;
	}

	return (
		<div className="game-board">
			<div className="game-info">
				<h2>Phase: {gameState?.phase}</h2>
				<h3>Round: {gameState?.currentRound}</h3>
			</div>

			<PlayerList players={players} currentPlayer={currentPlayer} gamePhase={gameState?.phase} />
		</div>
	);
}
