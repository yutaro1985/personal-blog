import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
  site: "http://localhost:4321",
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB", session: "auto" }),
      storage: r2({ binding: "MEDIA" }),
      admin: { locales: ["en", "ja"] },
      fonts: false,
    }),
  ],
  server: { host: "127.0.0.1" },
  devToolbar: { enabled: false },
});
