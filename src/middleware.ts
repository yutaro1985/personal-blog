import { defineMiddleware } from "astro:middleware";
import { localOnly, protectResponse } from "./lib/boundary.mjs";
export const onRequest = defineMiddleware(async (context, next) => {
  if (!localOnly(context.url))
    return protectResponse(
      new Response("Local migration PoC only", { status: 403 }),
    );
  return protectResponse(await next());
});
