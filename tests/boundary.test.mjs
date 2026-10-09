import test from "node:test";
import assert from "node:assert/strict";
import { localOnly, protectResponse } from "../src/lib/boundary.mjs";
test("allows loopback HTTP only and rejects deployed hosts", () => {
  for (const origin of [
    "http://localhost:4321",
    "http://127.0.0.1:4321",
    "http://[::1]:4321",
  ])
    assert.equal(localOnly(new URL(origin)), true);
  for (const origin of [
    "https://yu-suzu.site",
    "https://preview.workers.dev",
    "http://localhost.evil.invalid",
  ])
    assert.equal(localOnly(new URL(origin)), false);
});
test("overrides public caching for HTML, API, media and redirects", async () => {
  const response = protectResponse(
    new Response("draft", {
      status: 302,
      headers: { "Cache-Control": "public, max-age=3600", Location: "/login" },
    }),
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(
    response.headers.get("X-Robots-Tag"),
    "noindex, nofollow, noarchive",
  );
  assert.equal(response.headers.get("Location"), "/login");
  assert.equal(await response.text(), "draft");
});
test("disallows automatic development credential creation routes", () => {
  assert.equal(
    localOnly(new URL("http://localhost:4321/_emdash/api/setup/dev-bypass")),
    false,
  );
  assert.equal(
    localOnly(new URL("http://localhost:4321/_emdash/api/auth/dev-bypass/")),
    false,
  );
});
