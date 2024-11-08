import { Player } from "@/types/game";
import { ConnectButton, useActiveAddress, useConnection } from "arweave-wallet-kit";
import { useEffect } from "react";
import { useGameContext } from "../context/GameContext";
import { dryrunResult, formatAddress, messageResult } from "../lib/utils";

export const LandingPage = () => {
	const { currentPlayer, setCurrentPlayer, gameState } = useGameContext();
	const { connected } = useConnection();
	const activeAddress = useActiveAddress();

	const fetchPlayerProfile = async () => {
		if (!activeAddress || !gameState.gameProcess) {
			console.log("Missing required data:", { activeAddress, gameProcess: gameState.gameProcess });
			return;
		}

		console.log("Fetching profile for address:", activeAddress);

		// Create a default player profile
		const defaultProfile = {
			id: activeAddress,
			name: `Wolf_${formatAddress(activeAddress)}`,
			isAlive: true,
			role: undefined,
			isCreator: false,
		};

		try {
			// Use Get-Players handler instead and filter for the current player
			const playersRes = await dryrunResult(
				gameState.gameProcess,
				[
					{
						name: "Action",
						value: "Get-Players",
					},
				],
				{ address: activeAddress }
			);

			// Find the current player in the players list
			const currentPlayerData = playersRes?.find((player: Player) => player.id === activeAddress);

			if (currentPlayerData) {
				console.log("Found existing profile:", currentPlayerData);
				setCurrentPlayer({
					...defaultProfile,
					name: currentPlayerData.name,
					isCreator: Boolean(currentPlayerData.is_creator),
					isAlive: Boolean(currentPlayerData.is_alive),
					role: currentPlayerData.role,
				});
			} else {
				console.log("No existing profile found, using default");
				setCurrentPlayer(defaultProfile);
			}
		} catch (error) {
			console.log("Error fetching profile, using default:", error);
			setCurrentPlayer(defaultProfile);
		}
	};

	useEffect(() => {
		let mounted = true;

		const handleProfileSetup = async () => {
			if (!connected || !activeAddress) {
				setCurrentPlayer(null);
				return;
			}

			if (mounted) {
				await fetchPlayerProfile();
			}
		};

		handleProfileSetup();

		return () => {
			mounted = false;
		};
	}, [connected, activeAddress]); // Remove gameState.gameProcess from dependencies

	return (
		<div className="landing-container">
			<h1>Werewolf Game</h1>
			<div className="connect-section">
				{!connected ? (
					<div className="connect-wrapper">
						<p>Connect your wallet to play</p>
						<ConnectButton showBalance={false} className="connect-button" />
					</div>
				) : (
					<>
						<div className="player-info">
							{currentPlayer && <p>Playing as: {currentPlayer.name}</p>}
						</div>
						<JoinGame />
					</>
				)}
			</div>
		</div>
	);
};

const JoinGame = () => {
	const { setMode, currentPlayer, gameState } = useGameContext();

	const handleJoinGame = async () => {
		console.log("Join Game clicked", currentPlayer);

		if (!currentPlayer) {
			console.warn("No current player found");
			return;
		}

		try {
			const { Messages } = await messageResult(gameState.gameProcess, [
				{
					name: "Action",
					value: "Register-Player",
				},
				{
					name: "DisplayName",
					value: currentPlayer.name,
				},
			]);

			console.log("Registration response:", Messages);

			// Check if the player is already registered or successfully registered
			if (
				Messages?.[0]?.Data === "Successfully registered" ||
				Messages?.[0]?.Data.includes("already registered") ||
				Messages?.[0]?.Data.includes("Already registered")
			) {
				console.log("Setting mode to waiting");
				setMode("waiting");
			} else {
				console.warn("Unexpected registration response:", Messages?.[0]?.Data);
			}
		} catch (error) {
			console.error("Error joining game:", error);
		}
	};

	return (
		<div className="join-section">
			<button onClick={handleJoinGame} className="join-button">
				Join Game
			</button>
		</div>
	);
};
