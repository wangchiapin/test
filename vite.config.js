import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: change "ledger-app" below to match your GitHub repo name.
// e.g. if your repo is https://github.com/yourname/my-book,
// base should be "/my-book/"
export default defineConfig({
  plugins: [react()],
  base: "/moneybook/",
});
