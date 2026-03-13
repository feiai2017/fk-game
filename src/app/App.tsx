import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "@/app/routes";
import { GameStateProvider } from "@/hooks/useGameState";

export default function App(): JSX.Element {
  return (
    <GameStateProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </GameStateProvider>
  );
}

