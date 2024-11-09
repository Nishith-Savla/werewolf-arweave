import { useEffect, useState } from "react";
import type { GameMode } from "../context/GameContext";
import { useGameContext } from "../context/GameContext";
import { dryrunResult, messageResult } from "../lib/utils";
import "./GameRound.css";

interface DebugInfo {
	gameState: any;
	roleResult: any;
}

interface Player {
	id: string;
	name: string;
}

interface GameEvent {
	Action: string;
	Data: string;
}

const subscribeToGameEvents = (handler: (event: GameEvent) => void, gameState: any) => {
	const intervalId = setInterval(async () => {
		try {
			const gameStateResult = await dryrunResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Get-Game-State",
				},
			]);

			if (gameStateResult?.phase !== gameState.phase) {
				handler({
					Action: "Phase-Change",
					Data: gameStateResult.phase
				});
			}

			const result = await dryrunResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Get-Game-Events",
				},
			]);

			if (Array.isArray(result)) {
				result.forEach((event) => handler(event));
			}
		} catch (error) {
			console.error("Error fetching game events:", error);
		}
	}, 5000);

	return () => clearInterval(intervalId);
};

export const GameRound = () => {
	const { gameState, currentPlayer, mode, setMode, setGamestate } = useGameContext();
	const [role, setRole] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [debugInfo, setDebugInfo] = useState({});
	const [alivePlayers, setAlivePlayers] = useState<Player[]>([]);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [visions, setVisions] = useState<Array<{ target: string; role: string }>>([]);
	const [actionResult, setActionResult] = useState<string | null>(null);

	// Fetch alive players
	useEffect(() => {
		const fetchAlivePlayers = async () => {
			try {
				const result = await dryrunResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Alive-Players",
					},
				]);
				if (Array.isArray(result)) {
					setAlivePlayers(result);
				}
			} catch (error) {
				console.error("Error fetching alive players:", error);
			}
		};

		fetchAlivePlayers();
	}, [gameState.gameProcess]);

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

				const gameStateResult = await dryrunResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Game-State",
					},
				]);

				console.log("Current game state:", gameStateResult);

				if (gameStateResult?.phase !== "night") {
					throw new Error(`Invalid game phase: ${gameStateResult?.phase}`);
				}

				const { Messages } = await messageResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Role",
					},
				]);

				if (Messages?.[0]?.Data) {
					setRole(Messages[0].Data);
				}
			} catch (error) {
				console.error("Error in fetchRole:", error);
				setError(error.message);
			} finally {
				setIsLoading(false);
			}
		};

		fetchRole();
	}, [gameState.gameProcess, currentPlayer?.id]);

	// Fetch seer visions if player is seer
	useEffect(() => {
		const fetchVisions = async () => {
			if (role === "seer") {
				try {
					const result = await dryrunResult(gameState.gameProcess, [
						{
							name: "Action",
							value: "Get-Visions",
						},
					]);
					if (Array.isArray(result)) {
						setVisions(result);
					}
				} catch (error) {
					console.error("Error fetching visions:", error);
				}
			}
		};

		fetchVisions();
	}, [role, gameState.gameProcess]);

	// Subscribe to game events
	useEffect(() => {
		const handleGameEvents = (event: GameEvent) => {
			if (event.Action === "Phase-Change") {
				setMode(event.Data as GameMode);
				setGamestate((prevState: GameState) => ({
					...prevState,
					phase: event.Data,
				}));
			} else if (event.Action === "Player-Death") {
				setActionResult(`Player ${event.Data} has died!`);
			} else if (event.Action === "Seer-Result") {
				setActionResult(`The player's role is: ${event.Data}`);
			}
		};

		const unsubscribe = subscribeToGameEvents(handleGameEvents, gameState);
		return () => unsubscribe();
	}, [setMode, gameState, setGamestate]);

	const handleNightAction = async (action: string) => {
		if (!selectedPlayer) {
			alert("Please select a player first");
			return;
		}

		try {
			const { Messages } = await messageResult(
				gameState.gameProcess,
				[
					{
						name: "Action",
						value: "Night-Action",
					},
					{
						name: "Target",
						value: selectedPlayer,
					},
					{
						name: "ActionType",
						value: action,
					},
				]
			);

			if (Messages?.[0]?.Data) {
				alert(Messages[0].Data);
				setSelectedPlayer(null);
			}
		} catch (error) {
			console.error("Error performing night action:", error);
		}
	};

	const handleVote = async () => {
		if (!selectedPlayer) {
			alert("Please select a player first");
			return;
		}

		try {
			const { Messages } = await messageResult(
				gameState.gameProcess,
				[
					{
						name: "Action",
						value: "Vote",
					},
					{
						name: "votedId",
						value: selectedPlayer,
					},
				]
			);

			if (Messages?.[0]?.Data) {
				alert(Messages[0].Data);
				setSelectedPlayer(null);
			}
		} catch (error) {
			console.error("Error voting:", error);
		}
	};

	const renderGameActions = () => {
		if (mode === "night" && role) {
			return (
				<div className="night-actions">
					<h3 className="text-xl font-semibold mb-4">Night Actions</h3>

					{actionResult && (
						<div className="action-result mb-4 p-2 bg-blue-100 rounded">{actionResult}</div>
					)}

					{role === "seer" && visions.length > 0 && (
						<div className="visions-log mb-4">
							<h4 className="font-semibold">Your Visions:</h4>
							<ul className="list-disc pl-5">
								{visions.map((vision, index) => (
									<li key={index}>
										Player {vision.target} is a {vision.role}
									</li>
								))}
							</ul>
						</div>
					)}

					<div className="player-selection mb-4">
						<select
							value={selectedPlayer || ""}
							onChange={(e) => setSelectedPlayer(e.target.value)}
							className="w-full p-2 rounded border"
						>
							<option value="">Select a player</option>
							{alivePlayers.map(
								(player) =>
									player.id !== currentPlayer?.id && (
										<option key={player.id} value={player.id}>
											{player.name}
										</option>
									)
							)}
						</select>
					</div>

					<div className="action-buttons space-x-4">
						{role === "werewolf" && (
							<button
								onClick={() => handleNightAction("kill")}
								className="bg-red-600 text-white px-4 py-2 rounded"
								disabled={!selectedPlayer}
							>
								Kill Player
							</button>
						)}
						{role === "doctor" && (
							<button
								onClick={() => handleNightAction("protect")}
								className="bg-green-600 text-white px-4 py-2 rounded"
								disabled={!selectedPlayer}
							>
								Protect Player
							</button>
						)}
						{role === "seer" && (
							<button
								onClick={() => handleNightAction("see")}
								className="bg-blue-600 text-white px-4 py-2 rounded"
								disabled={!selectedPlayer}
							>
								See Role
							</button>
						)}
					</div>
				</div>
			);
		} else if (mode === "day") {
			return (
				<div className="day-actions">
					<h3 className="text-xl font-semibold mb-4">Day Actions</h3>
					<div className="player-selection mb-4">
						<select
							value={selectedPlayer || ""}
							onChange={(e) => setSelectedPlayer(e.target.value)}
							className="w-full p-2 rounded border"
						>
							<option value="">Select a player to vote</option>
							{alivePlayers.map(
								(player) =>
									player.id !== currentPlayer?.id && (
										<option key={player.id} value={player.id}>
											{player.name}
										</option>
									)
							)}
						</select>
					</div>
					<button onClick={handleVote} className="bg-purple-600 text-white px-4 py-2 rounded">
						Vote Player
					</button>
				</div>
			);
		}
		return null;
	};

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

			<div className="game-actions mb-6">{renderGameActions()}</div>

			<div className="mt-8 p-4 bg-gray-100 rounded">
				<h3 className="text-lg font-semibold mb-2">Debug Information</h3>
				<pre className="text-sm">{JSON.stringify(debugInfo, null, 2)}</pre>
			</div>
		</div>
	);
};
