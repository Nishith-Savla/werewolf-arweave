import { ArweaveWalletKit } from "arweave-wallet-kit";
import { GameProvider } from "./context/GameContext";
import { Game } from "./components/Game";

function App() {
  return (
    <ArweaveWalletKit
      config={{
        permissions: [
          "ACCESS_ADDRESS",
          "ACCESS_PUBLIC_KEY",
          "SIGN_TRANSACTION",
          "DISPATCH",
        ],
        ensurePermissions: true,
      }}
      theme={{
        displayTheme: "light",
      }}
    >
      <GameProvider>
        <Game />
      </GameProvider>
    </ArweaveWalletKit>
  );
}

export default App;
