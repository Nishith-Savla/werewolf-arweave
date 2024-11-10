import { createDataItemSigner, dryrun, message, result } from "@permaweb/aoconnect";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Executes a dry run of a process action
 */
export async function dryrunResult(
	gameProcess: string,
	tags: { name: string; value: string }[],
	data?: any
) {
	try {
		if (!isValidProcessId(gameProcess)) {
			throw new Error(`Invalid process ID: ${gameProcess}`);
		}

		console.log("Executing dryrun with:", {
			process: gameProcess,
			tags,
			data,
		});

		const res = await dryrun({
			process: gameProcess,
			tags,
			data: data ? JSON.stringify(data) : undefined,
		});

		// console.log("Raw dryrun response:", res);

		if (!res.Messages?.[0]?.Data) {
			console.warn("No data in dryrun response:", res);
			return null;
		}

		try {
			const parsedData = JSON.parse(res.Messages[0].Data);
			console.log("Dryrun result:", parsedData);
			return parsedData;
		} catch (e) {
			// console.log("Raw dryrun result:", res.Messages[0].Data);
			return res.Messages[0].Data;
		}
	} catch (error: any) {
		console.error("Dryrun error:", error);
		throw new Error(`Dryrun failed: ${error.message}`);
	}
}

/**
 * Sends a message to the process and waits for result
 */
export async function messageResult(
	gameProcess: string,
	tags: { name: string; value: string }[],
	data?: any
) {
	try {
		if (!isValidProcessId(gameProcess)) {
			throw new Error(`Invalid process ID: ${gameProcess}`);
		}

		console.log("Sending message with:", {
			process: gameProcess,
			tags,
			data,
		});

		// Ensure wallet is available
		if (!window.arweaveWallet) {
			throw new Error("Arweave wallet not found");
		}

		// Send the message
		const messageRes = await message({
			process: gameProcess,
			signer: createDataItemSigner(window.arweaveWallet),
			tags,
			data: data ? JSON.stringify(data) : undefined,
		});

		console.log("Message sent:", messageRes);

		// Wait for result
		const {
			Messages,
			Spawns,
			Output,
			Error: error,
		} = await result({
			message: messageRes,
			process: gameProcess,
		});

		if (error) {
			console.error("Process error:", error);
			throw new Error(error);
		}

		console.log("Message result:", {
			Messages,
			Spawns,
			Output,
		});

		return { Messages, Spawns, Output, error };
	} catch (error: any) {
		console.error("Message error:", error);
		throw new Error(`Message failed: ${error.message}`);
	}
}

/**
 * Helper to format wallet addresses
 */
export function formatAddress(address: string): string {
	if (!address) return "";
	return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Helper to handle async operations with error handling
 */
export async function handleAsync<T>(
	promise: Promise<T>,
	errorMessage: string
): Promise<[T | null, Error | null]> {
	try {
		const data = await promise;
		return [data, null];
	} catch (error) {
		console.error(errorMessage, error);
		return [null, error as Error];
	}
}

/**
 * Helper to validate game process responses
 */
export function validateProcessResponse(response: any, expectedAction?: string): boolean {
	if (!response?.Messages?.[0]?.Data) {
		console.warn("Invalid process response:", response);
		return false;
	}

	if (expectedAction && response.Messages[0].Action !== expectedAction) {
		console.warn(
			`Unexpected action. Expected ${expectedAction}, got ${response.Messages[0].Action}`
		);
		return false;
	}

	return true;
}

// Add process ID validation
function isValidProcessId(processId: string): boolean {
	// Basic validation for Arweave transaction IDs
	return /^[a-zA-Z0-9_-]{43}$/.test(processId);
}

/**
 * Example usage of utils:
 *
 * // Dry run example
 * const playerData = await dryrunResult(
 *   gameProcess,
 *   [{ name: "Action", value: "Get-Player" }]
 * );
 *
 * // Message example
 * const [result, error] = await handleAsync(
 *   messageResult(
 *     gameProcess,
 *     [{ name: "Action", value: "Register-Player" }],
 *     { playerName: "Player1" }
 *   ),
 *   "Failed to register player"
 * );
 *
 * if (error) {
 *   // Handle error
 * } else if (validateProcessResponse(result, "Register-Player")) {
 *   // Handle success
 * }
 */
