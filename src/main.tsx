import "@primer/primitives/dist/css/functional/themes/dark.css";
import { BaseStyles, ThemeProvider } from "@primer/react";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { orderSearchParams } from "./searchParams";
import "./app.scss";

const root = createRoot(document.getElementById("root")!);

root.render(
  <ThemeProvider colorMode="dark" dayScheme="dark" nightScheme="dark">
    <BaseStyles>
      <BrowserRouter>
        <NuqsAdapter processUrlSearchParams={orderSearchParams}>
          <App />
        </NuqsAdapter>
      </BrowserRouter>
    </BaseStyles>
  </ThemeProvider>,
);
