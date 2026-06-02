import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>,
);
