import { UIState } from "@/types/game";
import {
  ConnectButton,
  useActiveAddress,
  useConnection,
} from "arweave-wallet-kit";
import { useEffect } from "react";
import { useGameContext } from "../context/GameContext";
import { dryrunResult, formatAddress, messageResult } from "../lib/utils";
import "./LandingPage.css";

export const LandingPage = () => {
  const { currentPlayer, setCurrentPlayer, gameState } = useGameContext();
  const { connected } = useConnection();
  const activeAddress = useActiveAddress();

  const fetchPlayerProfile = async () => {
    if (!activeAddress || !gameState.gameProcess) {
      console.log("Missing required data:", {
        activeAddress,
        gameProcess: gameState.gameProcess,
      });
      return;
    }

    console.log("Fetching profile for address:", activeAddress);

    // Create a default player profile
    const defaultProfile = {
      id: activeAddress,
      name: formatAddress(activeAddress),
      isAlive: true,
      role: undefined,
      isCreator: false,
    };

    try {
      // First try to fetch Bazar profile
      const profileIdRes = await dryrunResult(
        "SNy4m-DrqxWl01YqGM4sxI8qCni-58re8uuJLvZPypY",
        [
          {
            name: "Action",
            value: "Get-Profiles-By-Delegate",
          },
        ],
        { Address: activeAddress },
      );

      let bazarName = null;
      if (profileIdRes && profileIdRes[0]?.ProfileId) {
        const profileRes = await dryrunResult(profileIdRes[0].ProfileId, [
          {
            name: "Action",
            value: "Info",
          },
        ]);

        if (profileRes?.Profile?.DisplayName) {
          bazarName = profileRes.Profile.DisplayName;
        }
      }

      // Now fetch game player data
      const playersRes = await dryrunResult(
        gameState.gameProcess,
        [
          {
            name: "Action",
            value: "Get-Players",
          },
        ],
        { address: activeAddress },
      );

      console.log("Raw players response:", playersRes);

      // Find the current player in the players list
      const currentPlayerData = playersRes?.find(
        (player: any) => player.id === activeAddress,
      );
      console.log("Found player data:", currentPlayerData);

      if (currentPlayerData) {
        console.log("Found existing profile:", currentPlayerData);
        setCurrentPlayer({
          ...defaultProfile,
          name: bazarName || currentPlayerData.name,
          bazarId: profileIdRes?.[0]?.ProfileId,
          isCreator: Boolean(currentPlayerData.is_creator),
          isAlive: Boolean(currentPlayerData.is_alive),
          role: currentPlayerData.role,
        });
      } else {
        console.log("No existing profile found, using default with Bazar name");
        setCurrentPlayer({
          ...defaultProfile,
          name: bazarName || defaultProfile.name,
          bazarId: profileIdRes?.[0]?.ProfileId,
        });
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
        setMode(UIState.Waiting);
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
