import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { App } from "./App";
import { DesktopApp } from "./pages/DesktopApp";
import "./styles/globals.css";

function Root() {
  const label = getCurrentWindow().label;

  // Route by Tauri window label
  if (label === "settings") {
    return <DesktopApp />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
