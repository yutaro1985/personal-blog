# 2026-10-09 検証結果

**ローカル検証基盤の実装は完了。Issue #1 の実データ移行・EmDash 採用判定・本番切替は未完了。**

## 対象

- Issue 本文 (2026-10-04 更新) とコメント 0 件を GitHub コネクターで取得。
- リモート HEAD `d192b6ffc4b263bb985c4e190617acc0f662b2c3` とローカル clean を確認。
- 元 checkout `/Users/yutaro.suzuki/personal-blog` は変更なし。
- 独立 clone: `/Users/yutaro.suzuki/Documents/Codex/2026-10-09/task/personal-blog`、ブランチ `codex/issue-1-local-migration-poc`。
- Node 24.20.0、npm 11.19.0、mise 2026.10.4、Astro 7.3.8、EmDash / Cloudflare adapter 1.2.0、Wrangler 4.149.0。
- upstream template 参照 SHA `1930243108073ebb41ff48533678af7635b01c37`。公開 SSR と公式 seed/変換器を利用し、独自 CMS/認証は実装していない。

## 実行結果

| 検証                                                             | 結果                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `mise run validate`                                              | 成功。format check / 全 unit tests / Astro 型検査 / build を順次実行                    |
| `npm test`                                                       | 18 件合格、失敗 0。WXR 状態/URL/DTD/XML/重複、非公開出力、境界、snapshot、upstream 変換 |
| `npm run check`                                                  | 24 ファイル、error 0 / warning 0 / hint 0                                               |
| `npm run build`                                                  | 成功。500 kB 超 chunk の Vite warning は残る                                            |
| `npm audit --json`                                               | 確認時点の既知脆弱性 0 件。非推奨の upstream 依存は残る                                 |
| `npm run inventory -- tests/fixtures/representative.xml`         | 6 件、publish 2 / draft 1 / private 1 / future 1 / inherit 1。検査エラー 0、出力 0600   |
| `npm run seed:local -- --server-stopped`                         | 合成 3 件。再実行は 3 件 skip、重複作成なし                                             |
| 開発版 HTTP                                                      | 9 経路 + 標準管理初期画面を確認                                                         |
| 復元後ビルド版 `POC_URL=http://127.0.0.1:4322 npm run test:http` | 9 経路 + 管理初期画面 + canonical/sitemap/分類見出しを確認                              |
| 外部 Host `example.invalid`                                      | 403                                                                                     |
| `/.private/recovery-check/manifest.json`                         | 404、バックアップを HTTP 配信しない                                                     |
| ローカル snapshot/restore                                        | 23 ファイルの SHA-256 照合に成功。現用状態は保全してから復元状態に切替                  |
| ローカル R2 `fixture.svg`                                        | 復元後の get 結果と元ファイルの `cmp` が一致                                            |
| DB のユーザー/認証 token 件数                                    | users / auth_tokens / API tokens / OAuth tokens はすべて 0                              |
| `git diff --check`                                               | 成功                                                                                    |

HTTP 9 経路: `/`、`/posts/日本語/`、`/pages/about/`、`/category/tech/`、`/tag/example/`、`/posts/draft-only/`、`/posts/missing/`、`/rss.xml`、`/robots.txt`。下書きと不存在は 404。他は 200。すべて本文、下書き文字列が出ないこと、no-store/noindex を検査した。管理画面は setup に遷移する初期画面までで、ログインの合格ではない。

## 途中で見つけて修正した点

- `trailingSlash: always` は管理 API の POST/typegen 経路まで変え、404 を起こした。全体への強制を外し、公開 URL の末尾 slash 方針は後続棚卸しで確定する。
- 自動 seed はスキーマのみ。合成コンテンツはサーバー停止中の公式 CLI によるオフライン seed で投入する。開発用認証 bypass は使わない。
- EmDash 1.2.0 のログインは Astro session に依存するため、アダプター注入のローカル KV を保持する。公開クエリキャッシュ用途ではない。
- Wrangler のホームディレクトリへのログ書き込みは sandbox 内で拒否されたため、作業ディレクトリの `.private/logs` に変更した。
- 外部フォント取得が sandbox の DNS 制約で失敗した。`fonts: false` とシステムフォントを採用し、最終ビルドは外部フォントを取得しない。
- `astro check/build` と dev server の同時実行で Vite の最適化キャッシュが競合した。サーバー停止後の順次検証に変更。
- 初期の型エラー、境界関数の編集時の構文エラーを修正し、再検査した。
- canonical と sitemap の origin/末尾 slash の差を HTTP 試験で検出し、ローカル origin と末尾 slash なしの canonical に揃えた。分類ページの見出しも検査対象に追加した。

## 未検証・本番移行を阻む入力

- 実 WordPress WXR/DB/uploads、全投稿・公開状態・実 URL/SEO/プラグイン依存の棚卸し。
- 実代表記事 3〜5 本の標準 importer による取り込みと画像/日時/分類/SEO の照合。合成 Portable Text 変換テストは全 WXR インポートの実証ではない。
- 管理画面での日本語 IME、画像追加、公開/非公開、スマートフォン、passkey/端末紛失復旧。
- 実署名プレビューの期限切れ・改ざん・別記事・匿名アクセス、役割権限、CSP、HTML/JS 埋め込みの安全性。
- クラウド D1/R2 のバックアップ/復元とログイン/編集再開、鍵履歴、RPO/RTO/保持期間。
- 公開キャッシュの有効化、更新/非公開化の伝播、同条件での性能比較と合意した基準値。
- ホスティング費用、DNS/メール/他サイト依存、全量リハーサル、切替/切り戻しの承認。

本番用秘密情報・ユーザーは未作成。SQL/WXR/実バックアップは未取得。実サイトへの書き込み、プラグイン導入、本番公開、DNS、課金リソース作成は実施していない。ローカルサーバーは検証後に停止した。

## 変更ファイルのまとまり

- `astro.config.mjs`, `wrangler.jsonc`, `mise.toml`, `package*.json`, `tsconfig.json`, `.npmrc`: ローカル構成/固定 toolchain。
- `src/worker.ts`, `src/middleware.ts`, `src/lib/boundary.mjs`: localhost とキャッシュ/検索境界。
- `src/pages/`, `src/layouts/Base.astro`, `src/live.config.ts`: SSR/SEO/RSS/管理連携。
- `seed/seed.json`, `emdash-env.d.ts`, `.emdash/migrations.json`: 合成モデル・記事と生成メタデータ。
- `scripts/`: WXR 棚卸し、合成 seed、snapshot/restore、HTTP 検査。
- `tests/`: 18 テスト、合成 WXR/SVG。
- `AGENTS.md`, `README.md`, `docs/`, `.gitignore`, `.prettier*`: 作業境界、手順、計画、結果、整形。

自己レビュー: Issue の目的とローカル境界、公開/下書き、実データ不在の明示、秘密情報/バックアップの Git 除外、復元の上書き防止、固定バージョンと手順の一致を確認。同じタスク内の独立したレビューエージェントが元コミットと修正差分を確認。3 件の P2 指摘 (WXR 構造、集計辞書の特殊キー、snapshot の特殊ファイル名欠落) を修正し、再レビューで新しい must-fix 指摘なし。修正後に `mise run validate` を再実行して成功した。

ローカル検証完了後、2026-10-09 に利用者から Issue コメントと draft PR 作成の許可を受領。公開対象は `yutaro1985/personal-blog` の `codex/issue-1-local-migration-poc` → `main`。Issue #1 全体を close する内容ではない。Project 更新、本番公開、DNS 切替、課金リソース作成は対象外。

## 独立レビュー後の追記

不正な WXR の channel/version/item 構造と重複状態フィールドを拒否し、投稿タイプ/状態の集計に Map を使用した。snapshot のハッシュ辞書を null-prototype に変更し、`__proto__` という名前のファイルも復元する。3 つの回帰テストは修正前に失敗し、修正後に成功。認証 bypass に関する一時的な疑いは、Astro が middleware より前に URL を正規化する実装を確認して撤回され、認証経路の変更はしていない。

画像の path traversal/backup-prefix 対策は pinned upstream の実装を静的確認。秘密情報については追跡対象ファイルの典型的パターン検査を実施したが、完全検出の保証ではない。新しい認証情報の作成、実データの取得、公開は行っていない。

[受入条件の照合と最小必要入力](acceptance-status.md) を追加。実 WXR と画像原本を受領する前に、これ以上の実データ移行の合格判定は進められない。
