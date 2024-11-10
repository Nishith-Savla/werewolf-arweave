import { useCallback, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useGameContext } from "../context/GameContext";
import { dryrunResult } from "../lib/utils";

const Toast = Swal.mixin({
	toast: true,
	position: "top-end",
	showConfirmButton: false,
	timer: 5000,
	timerProgressBar: true,
	didOpen: (toast) => {
		toast.addEventListener("mouseenter", Swal.stopTimer);
		toast.addEventListener("mouseleave", Swal.resumeTimer);
	},
});

export const useGameEvents = () => {
	const { gameState, setGamestate, setMode } = useGameContext();
	const lastPhase = useRef(gameState.phase);
	const processedEvents = useRef(new Set<string>());

	const handleGameEvent = useCallback(
		async (event: any) => {
			const eventId = `${event.Action}-${JSON.stringify(event.Data)}`;

			if (processedEvents.current.has(eventId)) {
				return;
			}

			processedEvents.current.add(eventId);

			switch (event.Action) {
				case "Phase-Change":
					const phase = typeof event.Data === "string" ? event.Data : event.Data.phase;

					if (phase !== lastPhase.current) {
						lastPhase.current = phase;
						setGamestate((prev) => ({ ...prev, phase }));
						setMode(phase);

						const message =
							typeof event.Data === "string" ? `Phase changed to ${phase}` : event.Data.message;

						Toast.fire({
							icon: "info",
							title: message,
						});
					}
					break;

				case "Player-Death":
					Swal.fire({
						title: "A Player Has Died!",
						text: `${event.Data.playerName} was killed during the night!`,
						icon: "error",
						timer: 3000,
						showConfirmButton: false,
					});
					break;

				case "Player-Protected":
					Toast.fire({
						icon: "success",
						title: "Someone was protected by the doctor!",
					});
					break;

				case "Vote-Cast":
					Toast.fire({
						icon: "info",
						title: `Vote recorded (${event.Data.votersCount}/${event.Data.totalVoters})`,
					});
					break;

				case "Player-Eliminated":
					Swal.fire({
						title: "Player Eliminated!",
						text: `${event.Data.playerName} was eliminated by vote! They were a ${event.Data.playerRole}`,
						icon: "warning",
						timer: 3000,
						showConfirmButton: false,
					});
					break;

				case "Game-Over":
					Swal.fire({
						title: "Game Over!",
						text: `The ${event.Data} win!`,
						icon: "success",
						confirmButtonText: "OK",
					});
					break;

				case "Vote-Result":
					if (event.Data.result === "tie") {
						Toast.fire({
							icon: "warning",
							title: "Vote resulted in a tie. No one was eliminated.",
						});
					}
					break;

				case "Vote-Error":
					Toast.fire({
						icon: "error",
						title: event.Data.message || "Error during voting",
					});
					break;
			}
		},
		[setGamestate, setMode]
	);

	useEffect(() => {
		if (!gameState.gameProcess) return;

		let mounted = true;
		const pollEvents = async () => {
			if (!mounted) return;

			try {
				const events = await dryrunResult(gameState.gameProcess, [
					{
						name: "Action",
						value: "Get-Game-Events",
					},
				]);

				if (Array.isArray(events) && mounted) {
					for (const event of events) {
						await handleGameEvent(event);
					}
				}
			} catch (error) {
				console.error("Error polling game events:", error);
			}
		};

		const intervalId = setInterval(pollEvents, 5000);
		pollEvents(); // Initial poll

		return () => {
			mounted = false;
			clearInterval(intervalId);
			processedEvents.current.clear();
		};
	}, [gameState.gameProcess, handleGameEvent]);
};
