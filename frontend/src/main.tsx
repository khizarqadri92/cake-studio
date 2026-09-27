import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { applyLanguage } from "./i18n";
import { applyTheme } from "./theme";
import { publicApi } from "./api/publicLocale";

// Resolve the organization's language before the app renders, so the login
// page itself (which nobody is authenticated for yet) shows in the right
// language and direction from the very first paint. Theme, before login,
// just follows the OS preference - a personal light/dark choice only
// applies once someone is actually signed in to their own account.
async function bootstrap() {
  applyTheme("system");

  try {
    const { default_language } = await publicApi.getLocale();
    applyLanguage(default_language);
  } catch {
    applyLanguage("en"); // fall back quietly if the API isn't reachable yet
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
