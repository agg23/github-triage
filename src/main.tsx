import "@primer/primitives/dist/css/functional/themes/dark.css";
import { BaseStyles, ThemeProvider } from "@primer/react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./app.scss";

const root = createRoot(document.getElementById("root")!);

root.render(
  <ThemeProvider colorMode="dark" dayScheme="dark" nightScheme="dark">
    <BaseStyles>
      <App />
    </BaseStyles>
  </ThemeProvider>,
);
