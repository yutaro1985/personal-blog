import test from "node:test";
import assert from "node:assert/strict";
import { gutenbergToPortableText } from "@emdash-cms/gutenberg-to-portable-text";
// Acceptance probe for the pinned upstream converter, not a complete WXR import.
test("EmDash 1.2 converter preserves Japanese heading, link, image alt and code", () => {
  const blocks = gutenbergToPortableText(
    '<!-- wp:heading --><h2>日本語の見出し</h2><!-- /wp:heading --><!-- wp:paragraph --><p>本文 <a href="https://example.invalid/keep/">リンク</a></p><!-- /wp:paragraph --><!-- wp:image --><figure><img src="https://example.invalid/image.png" alt="画像の説明"/></figure><!-- /wp:image --><!-- wp:code --><pre><code>const x = 1;</code></pre><!-- /wp:code -->',
  );
  assert.equal(blocks[0].style, "h2");
  assert.equal(blocks[0].children[0].text, "日本語の見出し");
  assert.equal(blocks[1].markDefs[0].href, "https://example.invalid/keep/");
  assert.equal(blocks[2].asset.url, "https://example.invalid/image.png");
  assert.equal(blocks[2].alt, "画像の説明");
  assert.equal(blocks[3].code, "const x = 1;");
});
