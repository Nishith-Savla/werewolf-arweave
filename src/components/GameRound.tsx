import { useEffect, useState } from "react";
import { useGameContext } from "../context/GameContext";
import { dryrunResult, messageResult } from "../lib/utils";

interface DebugInfo {
	gameState: any;
	roleResult: any;
}

export const GameRound = () => {
	const { gameState, currentPlayer, mode, setMode } = useGameContext();
	const [role, setRole] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [debugInfo, setDebugInfo] = useState({});

	useEffect(() => {
		const fetchRole = async () => {
			if (!currentPlayer?.id) {
				console.error("No current player ID");
				setError("No player ID found");
				setIsLoading(false);
				return;
			}

			try {
				console.log("Fetching role for player:", currentPlayer.id);
				setIsLoading(true);
				
				// First get game state to ensure we're in the right phase
				const gameStateResult = await dryrunResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Game-State",
					}
				]);

				console.log("Current game state:", gameStateResult);

				if (gameStateResult?.phase !== "night") {
					throw new Error(`Invalid game phase: ${gameStateResult?.phase}`);
				}

				// Get role for current player
				const { Messages } = await messageResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Role",
					}
				]);

				console.log("Role response:", Messages);
				
				if (!Messages?.[0]?.Data) {
					throw new Error("No role data received");
				}

				setRole(Messages[0].Data);
				setDebugInfo({
					gameState: gameStateResult,
					currentPlayer,
					mode,
					roleResponse: Messages[0]
				});
				setIsLoading(false);

			} catch (error: any) {
				console.error("Error in fetchRole:", error);
				setError(error.message);
				setIsLoading(false);
			}
		};

		fetchRole();
	}, [gameState.gameProcess, currentPlayer?.id]);

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4">
				<p className="text-lg">Loading game state...</p>
				<div className="text-sm text-gray-500 space-y-2">
					<p>Game Process: {gameState.gameProcess}</p>
					<p>Player ID: {currentPlayer?.id}</p>
					<p>Current Mode: {mode}</p>
					<p>Is Creator: {currentPlayer?.isCreator ? "Yes" : "No"}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4">
				<p className="text-red-500 text-lg">{error}</p>
				<pre className="text-sm bg-gray-100 p-4 rounded">
					Debug Info:
					{JSON.stringify(debugInfo, null, 2)}
				</pre>
			</div>
		);
	}

	return (
		<div className="game-round p-6">
			<div className="game-info mb-6">
				<h2 className="text-2xl font-bold mb-2">Game Round</h2>
				<p className="text-lg">Phase: {mode.charAt(0).toUpperCase() + mode.slice(1)}</p>
				<p className="text-lg">Your Role: {role || "Unknown"}</p>
				<p className="text-lg">Game Phase: {gameState?.phase || "Unknown"}</p>
			</div>

			<div className="game-actions">
				{/* Add game actions here based on the player's role and current phase */}
			</div>

			<div className="mt-8 p-4 bg-gray-100 rounded">
				<h3 className="text-lg font-semibold mb-2">Debug Information</h3>
				<pre className="text-sm">{JSON.stringify(debugInfo, null, 2)}</pre>
			</div>
		</div>
	);
};
