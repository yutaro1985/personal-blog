import handler from "@emdash-cms/cloudflare/worker";
import { localOnly, protectResponse } from "./lib/boundary.mjs";

// No cron or plugin bridge is enabled in this local-only PoC.
export default {
  async fetch(
    request: Request,
    env: Parameters<NonNullable<typeof handler.fetch>>[1],
    context: Parameters<NonNullable<typeof handler.fetch>>[2],
  ) {
    if (!localOnly(new URL(request.url)))
      return protectResponse(
        new Response("Local migration PoC only", { status: 403 }),
      );
    return protectResponse(await handler.fetch!(request, env, context));
  },
};
