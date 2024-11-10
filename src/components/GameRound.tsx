import { useEffect, useState } from "react";
import type { GameMode } from "../context/GameContext";
import { useGameContext } from "../context/GameContext";
import { dryrunResult, messageResult } from "../lib/utils";
import { GameNotifications } from "./GameNotifications";
import "./GameRound.css";

interface DebugInfo {
	gameState: any;
	roleResult: any;
	userDetails: {
		id: string | null;
		name: string | null;
		isCreator: boolean;
		role?: string | null;
		error?: string;
	};
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

			if (gameStateResult && gameStateResult.phase !== gameState.phase) {
				handler({
					Action: "Phase-Change",
					Data: gameStateResult.phase,
				});
			}

			const result = await dryrunResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Get-Game-Events",
				},
			]);

			if (result && Array.isArray(result)) {
				result.forEach((event) => handler(event));
			}
		} catch (error) {
			console.error("Error in game events subscription:", error);
		}
	}, 10000);

	return () => clearInterval(intervalId);
};

export const GameRound = () => {
	const { gameState, currentPlayer, mode, setMode, setGamestate } = useGameContext();
	const [role, setRole] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
	const [alivePlayers, setAlivePlayers] = useState<Player[]>([]);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [visions, setVisions] = useState<Array<{ target: string; role: string }>>([]);
	const [actionResult, setActionResult] = useState<string | null>(null);
	const [isAlive, setIsAlive] = useState<boolean>(true);

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
				setDebugInfo({
					gameState: null,
					roleResult: null,
					userDetails: {
						id: currentPlayer?.id || null,
						name: currentPlayer?.name || null,
						isCreator: currentPlayer?.isCreator || false,
						error: "No player ID found",
					},
				});
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

				const { Messages } = await messageResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Role",
					},
				]);

				setDebugInfo({
					gameState: gameStateResult,
					roleResult: Messages?.[0]?.Data || null,
					userDetails: {
						id: currentPlayer.id,
						name: currentPlayer.name,
						isCreator: currentPlayer.isCreator || false,
						role: Messages?.[0]?.Data || null,
					},
				});

				if (Messages?.[0]?.Data) {
					setRole(Messages[0].Data);
				} else {
					console.error("No role data received");
					setError("Could not fetch role");
				}
			} catch (error: any) {
				console.error("Error in fetchRole:", error);
				setError(error.message);
				setDebugInfo({
					gameState: await dryrunResult(gameState.gameProcess, [
						{
							name: "Action",
							value: "Get-Game-State",
						},
					]).catch(() => null),
					roleResult: null,
					userDetails: {
						id: currentPlayer.id,
						name: currentPlayer.name,
						isCreator: currentPlayer.isCreator || false,
						error: error.message,
					},
				});
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
		const handleGameEvent = async (event: GameEvent) => {
			try {
				if (event.Action === "Phase-Change") {
					setGamestate((prev) => ({
						...prev,
						phase: event.Data,
					}));
					setMode(event.Data as GameMode);

					setSelectedPlayer(null);
					setActionResult(null);

					const alivePlayers = await dryrunResult(gameState.gameProcess, [
						{
							name: "Action",
							value: "Get-Alive-Players",
						},
					]);
					if (Array.isArray(alivePlayers)) {
						setAlivePlayers(alivePlayers);
					}
				}
			} catch (error) {
				console.error("Error handling game event:", error);
			}
		};

		const unsubscribe = subscribeToGameEvents(handleGameEvent, gameState);
		return () => unsubscribe();
	}, [gameState, setMode, setGamestate]);

	useEffect(() => {
		const checkAliveStatus = async () => {
			if (!currentPlayer?.id) return;

			try {
				const { Messages } = await messageResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Check-Alive",
					},
				]);

				// Handle the response more carefully
				if (Messages?.[0]) {
					const isAliveResponse = Messages[0].Data;
					console.log("Is alive response:", isAliveResponse);
					setIsAlive(isAliveResponse === true || isAliveResponse === 1);
				}
			} catch (error) {
				console.error("Error checking alive status:", error);
				setIsAlive(false); // Assume dead if error
			}
		};

		checkAliveStatus();

		const interval = setInterval(checkAliveStatus, 10000);

		return () => clearInterval(interval);
	}, [currentPlayer?.id, gameState.gameProcess]);

	const handleNightAction = async (action: string) => {
		if (!selectedPlayer) {
			alert("Please select a player first");
			return;
		}

		try {
			const { Messages } = await messageResult(gameState.gameProcess, [
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
			]);

			if (Messages?.length > 0) {
				if (role === "seer") {
					setActionResult(Messages[0].Data); // Set the revealed role

					// Refresh visions list
					const visionsResult = await dryrunResult(gameState.gameProcess, [
						{
							name: "Action",
							value: "Get-Visions",
						},
					]);
					if (Array.isArray(visionsResult)) {
						setVisions(visionsResult);
					}
				} else {
					// For other roles (doctor, werewolf), show the action confirmation
					alert(Messages[0].Data);
				}
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
			// First check if player is alive
			const { Messages } = await messageResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Check-Alive",
				},
			]);

			if (Messages?.[0]?.Data === false) {
				alert("You cannot vote because you are dead");
				return;
			}

			const voteResult = await messageResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Vote",
				},
				{
					name: "votedId",
					value: selectedPlayer,
				},
			]);

			if (voteResult.Messages?.[0]?.Data) {
				alert(voteResult.Messages[0].Data);
				setSelectedPlayer(null);
			}
		} catch (error) {
			console.error("Error voting:", error);
			alert("Failed to cast vote");
		}
	};

	const renderGameActions = () => {
		if (gameState.phase === "night" && role) {
			if (isAlive === false) {
				return (
					<div className="night-actions">
						<h3 className="text-xl font-semibold mb-4">Night Phase</h3>
						<div className="dead-player-message p-4 bg-red-100 border border-red-400 rounded">
							<p className="text-red-700">You are dead and cannot perform night actions.</p>
							<p className="text-gray-600 mt-2">You can continue to watch the game unfold.</p>
						</div>
					</div>
				);
			}
			// Only show night actions for roles that can act at night
			if (role === "villager") {
				return (
					<div className="night-actions">
						<h3 className="text-xl font-semibold mb-4">Night Phase</h3>
						<p>You are a villager. Wait for others to complete their night actions.</p>
					</div>
				);
			}

			return (
				<div className="night-actions">
					<h3 className="text-xl font-semibold mb-4">Night Actions</h3>

					{actionResult && (
						<div className="action-result mb-4 p-2 bg-blue-100 rounded">
							{role === "seer" ? `Player's role: ${actionResult}` : actionResult}
						</div>
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
							{alivePlayers.map((player) => {
								// Skip self-selection for seer only
								if (role === "seer" && player.id === currentPlayer?.id) {
									return null;
								}
								return (
									<option key={player.id} value={player.id}>
										{player.name} {player.id === currentPlayer?.id ? "(You)" : ""}
									</option>
								);
							})}
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
		} else if (gameState.phase === "day") {
			if (isAlive === false) {
				return (
					<div className="day-actions">
						<h3 className="text-xl font-semibold mb-4">Day Phase</h3>
						<div className="dead-player-message p-4 bg-red-100 border border-red-400 rounded">
							<p className="text-red-700">You are dead and cannot participate in voting.</p>
							<p className="text-gray-600 mt-2">You can continue to watch the game unfold.</p>
						</div>
					</div>
				);
			}

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
					<button
						onClick={handleVote}
						className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
					>
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
			<GameNotifications />
			<div className="game-info mb-6">
				<h2 className="text-2xl font-bold mb-2">Game Round</h2>
				<p className="text-lg">Phase: {mode.charAt(0).toUpperCase() + mode.slice(1)}</p>
				<p className="text-lg">Your Role: {role || "Loading..."}</p>
				<p className="text-lg">Game Phase: {gameState?.phase || "Unknown"}</p>
			</div>

			<div className="game-actions mb-6">{renderGameActions()}</div>

			{process.env.NODE_ENV === "development" && (
				<div className="mt-8 p-4 bg-gray-100 rounded debug-info">
					<h3 className="text-lg font-semibold mb-2">Debug Information</h3>
					<pre className="text-sm">{JSON.stringify(debugInfo, null, 2)}</pre>
				</div>
			)}
		</div>
	);
};
