import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
export const GET: APIRoute = async ({ url }) => {
  const site = new URL(url.origin);
  const { entries, error } = await getEmDashCollection("posts", {
    status: "published",
    limit: 20,
    orderBy: { published_at: "desc" },
  });
  if (error) throw error;
  const items = entries
    .map((post) => {
      const url = new URL(`/posts/${encodeURIComponent(post.id)}/`, site).href;
      return `<item><title>${escape(post.data.title)}</title><link>${escape(url)}</link><guid>${escape(url)}</guid><description>${escape(post.data.excerpt ?? "")}</description>${post.data.publishedAt ? `<pubDate>${post.data.publishedAt.toUTCString()}</pubDate>` : ""}</item>`;
    })
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>移行検証ブログ</title><link>${site}</link><description>合成データによる検証</description><language>ja</language>${items}</channel></rss>`,
    { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } },
  );
};
