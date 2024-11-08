import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { useGameContext } from "../context/GameContext";
import { dryrunResult, messageResult } from "../lib/utils";

interface PlayerResponse {
	id?: string;
	address?: string;
	name?: string;
	displayName?: string;
	isCreator?: boolean;
}

export const WaitingRoom = () => {
	const { currentPlayer, joinedPlayers, setJoinedPlayers, setMode, gameState, setCurrentPlayer } =
		useGameContext();
	const [isLoading, setIsLoading] = useState(true);

	console.log("Current player:", currentPlayer);
	console.log("Is creator:", currentPlayer?.isCreator);

	const fetchPlayers = useCallback(async () => {
		try {
			console.log("Fetching players for process:", gameState.gameProcess);

			// First try to get the game state
			const gameStateResult = await dryrunResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Get-Game-State",
				},
			]);
			console.log("Game state result:", gameStateResult);

			// Try Get-Players only if game state indicates we need to
			if (gameStateResult?.phase === "lobby") {
				const result = await dryrunResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Players",
					},
				]);

				if (result && Array.isArray(result)) {
					const validPlayers = result
						.filter((player): player is PlayerResponse => !!player)
						.map((player) => ({
							id: player.id || player.address || "",
							name: player.name || player.displayName || "",
							isCreator: Boolean(player.isCreator),
							isAlive: true,
						}))
						.filter((player) => player.id && player.name);

					// Update current player's creator status if needed
					if (currentPlayer) {
						const playerData = validPlayers.find((p) => p.id === currentPlayer.id);
						if (playerData?.isCreator) {
							setCurrentPlayer({
								...currentPlayer,
								isCreator: true,
							});
						}
					}

					// Only set loading and update if players have changed
					if (JSON.stringify(validPlayers) !== JSON.stringify(joinedPlayers)) {
						setIsLoading(true);
						setJoinedPlayers(validPlayers);
						setIsLoading(false);
					}
				}
			}
		} catch (error) {
			console.error("Error fetching players:", error);
		}
	}, [gameState.gameProcess, currentPlayer, setCurrentPlayer, joinedPlayers]);

	useEffect(() => {
		if (!gameState.gameProcess) return;

		// Initial fetch
		fetchPlayers();

		// Set up interval
		const interval = setInterval(fetchPlayers, 5000);

		// Cleanup
		return () => {
			clearInterval(interval);
		};
	}, [gameState.gameProcess, fetchPlayers]);

	useEffect(() => {
		const checkRegistration = async () => {
			if (!currentPlayer?.id) {
				console.log("No player ID found, redirecting to landing");
				setMode("landing");
				return;
			}

			try {
				const result = await dryrunResult(
					gameState.gameProcess,
					[
						{
							name: "Action",
							value: "Get-Players",
						},
					],
					{ address: currentPlayer.id }
				);

				const playerExists = result?.some((player: any) => player.id === currentPlayer.id);

				if (!playerExists) {
					console.log("Player not registered, redirecting to landing");
					setMode("landing");
				}

				console.log("Player registration check result:", result);
			} catch (error) {
				console.error("Error checking registration:", error);
				setMode("landing");
			}
		};

		checkRegistration();
	}, [gameState.gameProcess, setMode, currentPlayer?.id]);

	if (isLoading) {
		return <div className="waiting-room">Loading...</div>;
	}

	const handleStartGame = async () => {
		if (!currentPlayer?.isCreator) {
			console.warn("Only creator can start the game");
			return;
		}

		try {
			console.log("Starting game...");
			const { Messages } = await messageResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Start-Game",
				},
			]);

			console.log("Start game response:", Messages);

			// Check for both possible response formats
			if (
				Messages?.[0]?.Data === "Game started" ||
				Messages?.[0]?.Data?.status === "Game started"
			) {
				console.log("Game started successfully");
				setMode("night");
			} else {
				console.warn("Unexpected response:", Messages?.[0]?.Data);
				alert("Failed to start game. Please try again.");
			}
		} catch (error) {
			console.error("Error starting game:", error);
			alert("Failed to start game. Please try again.");
		}
	};

	const handleLeaveRoom = async () => {
		try {
			const { Messages } = await messageResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Leave-Game",
				},
			]);

			if (Messages?.[0]?.Data === "Left game") {
				setMode("landing");
			}
		} catch (error) {
			console.error("Error leaving room:", error);
		}
	};

	return (
		<div className="waiting-room">
			<h2 className="text-2xl font-bold mb-6">Waiting Room</h2>

			<div className="players-list mb-6">
				<h3 className="text-xl mb-4">Players ({joinedPlayers.length}/8)</h3>
				{joinedPlayers.map((player) => (
					<div key={player.id} className="player-card">
						<span>{player.name}</span>
						{player.isCreator && <span className="creator-badge">Creator</span>}
					</div>
				))}
			</div>

			<div className="actions flex gap-4 justify-center mt-8">
				{currentPlayer?.isCreator && (
					<Button
						onClick={handleStartGame}
						disabled={joinedPlayers.length < 4}
						className="px-8"
						variant="default"
						size="lg"
					>
						Start Game {joinedPlayers.length < 4 && `(Need ${4 - joinedPlayers.length} more)`}
					</Button>
				)}
				<Button onClick={handleLeaveRoom} variant="outline" size="lg" className="px-8">
					Leave Room
				</Button>
			</div>

			{!currentPlayer?.isCreator && (
				<p className="text-center mt-4 text-muted-foreground">
					Waiting for the creator to start the game...
				</p>
			)}
		</div>
	);
};
