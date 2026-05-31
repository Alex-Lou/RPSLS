import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
// Side-effect import: registers @font-face for every theme's font family
// (Inter, Cinzel, Orbitron, …) so they're available regardless of which
// theme is currently selected.
import "./fonts";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
