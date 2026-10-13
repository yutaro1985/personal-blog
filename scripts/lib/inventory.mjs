import sax from "sax";
import { createHash } from "node:crypto";

const WP = "http://wordpress.org/export/1.2/";
const CONTENT = "http://purl.org/rss/1.0/modules/content/";
const fields = {
  title: "title",
  link: "url",
  [`${WP}|post_id`]: "id",
  [`${WP}|post_name`]: "slug",
  [`${WP}|post_type`]: "type",
  [`${WP}|status`]: "status",
  [`${WP}|post_password`]: "passwordProtected",
  [`${WP}|post_date`]: "dateLocal",
  [`${WP}|post_date_gmt`]: "dateGmt",
  [`${WP}|attachment_url`]: "attachmentUrl",
};

/** Offline inventory only. Never renders HTML, fetches URLs, or changes publication state. */
export function inventory(xml) {
  if (Buffer.byteLength(xml) > 32 * 1024 * 1024)
    throw new Error("WXR exceeds 32 MiB; split the export first");
  const parser = sax.parser(true, { xmlns: true });
  const stack = [];
  const items = [];
  let current, wxrVersion, root;
  let channels = 0;
  parser.ondoctype = () => {
    throw new Error("DTD is not supported");
  };
  parser.onopentag = (node) => {
    const key = node.uri ? `${node.uri}|${node.local}` : node.local;
    if (!root) root = key;
    stack.push({ key, text: "", attributes: node.attributes });
    if (key === "channel") {
      if (stack.length !== 2 || stack[0].key !== "rss" || ++channels !== 1)
        throw new Error("Invalid WXR channel structure");
    }
    if (key === "item") {
      if (current || stack.length !== 3 || stack[1].key !== "channel")
        throw new Error("Nested or misplaced WXR item");
      current = { categories: [], media: [], flags: [] };
    }
  };
  parser.ontext = parser.oncdata = (text) => {
    if (stack.length) stack.at(-1).text += text;
  };
  parser.onclosetag = () => {
    const node = stack.pop();
    if (node.key === `${WP}|wxr_version`) {
      if (
        stack.length !== 2 ||
        stack[1].key !== "channel" ||
        wxrVersion !== undefined
      )
        throw new Error("Invalid WXR version declaration");
      wxrVersion = node.text.trim();
    }
    if (!current) return;
    if (stack.at(-1)?.key === "item") {
      if (Object.hasOwn(fields, node.key)) {
        const field = fields[node.key];
        if (Object.hasOwn(current, field))
          throw new Error("Duplicate WXR field");
        current[field] =
          field === "passwordProtected"
            ? node.text.length > 0
            : node.text.trim();
      }
      if (node.key === "category")
        current.categories.push({
          taxonomy: node.attributes.domain?.value ?? "",
          slug: node.attributes.nicename?.value ?? "",
          label: node.text,
        });
      if (node.key === `${CONTENT}|encoded`) {
        if (Object.hasOwn(current, "contentSha256"))
          throw new Error("Duplicate WXR field");
        const html = node.text;
        current.contentSha256 = createHash("sha256").update(html).digest("hex");
        current.contentBytes = Buffer.byteLength(html);
        const patterns = {
          gutenberg: /<!--\s*wp:/i,
          shortcode: /\[[a-z][\w-]*(?:\s[^\]]*)?\]/i,
          "html-script": /<script\b|\bon\w+\s*=|javascript:/i,
          "embedded-content": /<(?:iframe|object|embed|video)\b/i,
          table: /<table\b/i,
          code: /<(?:pre|code)\b/i,
        };
        current.flags = Object.entries(patterns)
          .filter(([, regex]) => regex.test(html))
          .map(([name]) => name);
        // Conservative reference hints, not a complete browser HTML/CSS parser.
        current.media = [
          ...new Set(
            [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(
              (m) => m[1],
            ),
          ),
        ];
        if (/\bsrcset\s*=|url\s*\(/i.test(html))
          current.flags.push("responsive-or-css-media-review");
      }
    }
    if (node.key === "item") {
      current.passwordProtected ??= false;
      items.push(current);
      current = undefined;
    }
  };
  parser.write(xml).close();
  if (root !== "rss" || channels !== 1 || wxrVersion !== "1.2")
    throw new Error("Expected WordPress WXR 1.2");
  const byStatus = new Map(),
    byType = new Map(),
    issues = [],
    seen = new Set(),
    urls = new Set();
  for (const item of items) {
    if (item.passwordProtected)
      issues.push({ code: "password-protected", id: item.id ?? null });
    const status = item.status || "unknown",
      type = item.type || "unknown";
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byType.set(type, (byType.get(type) ?? 0) + 1);
    for (const field of ["id", "type", "status", "url"])
      if (!item[field])
        issues.push({ code: `missing-${field}`, id: item.id ?? null });
    if (item.id && seen.has(item.id))
      issues.push({ code: "duplicate-id", id: item.id });
    if (item.url && urls.has(item.url))
      issues.push({ code: "duplicate-url", id: item.id });
    seen.add(item.id);
    urls.add(item.url);
    if (
      item.status &&
      ![
        "publish",
        "draft",
        "private",
        "future",
        "pending",
        "inherit",
        "trash",
        "auto-draft",
      ].includes(item.status)
    )
      issues.push({ code: "unknown-status", id: item.id });
  }
  return {
    version: 1,
    sourceSha256: createHash("sha256").update(xml).digest("hex"),
    total: items.length,
    byStatus: Object.fromEntries(byStatus),
    byType: Object.fromEntries(byType),
    issues,
    items,
    limitations: [
      "Media references are hints; srcset, CSS, shortcodes and external assets require review.",
      "WXR contains no media binaries. This is not an import or acceptance report.",
    ],
  };
}
