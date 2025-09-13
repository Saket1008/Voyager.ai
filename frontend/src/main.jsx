import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import "react-datepicker/dist/react-datepicker.css";
import { DevSettingsProvider } from './context/DevSettingsContext.jsx';
import DevPanel from './components/DevPanel.jsx';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DevSettingsProvider>
      <App />
      <DevPanel />
    </DevSettingsProvider>
  </React.StrictMode>
);
