import { useConnection } from 'arweave-wallet-kit';
import { useGameContext } from '../context/GameContext';
import { LandingPage } from './LandingPage';
import { WaitingRoom } from './WaitingRoom';
import { GameRound } from './GameRound';
import { useEffect } from 'react';

export const Game = () => {
  const { mode, setMode, setCurrentPlayer } = useGameContext();
  const { connected } = useConnection();

  useEffect(() => {
    if (!connected) {
      setMode("landing");
      setCurrentPlayer(null);
    }
  }, [connected, setMode, setCurrentPlayer]);

  return (
    <div className="game-container">
      {mode === "landing" && <LandingPage />}
      {mode === "waiting" && <WaitingRoom />}
      {(mode === "night" || mode === "day") && <GameRound />}
    </div>
  );
}; 
