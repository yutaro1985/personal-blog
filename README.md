# personal-blog

[Issue #1](https://github.com/yutaro1985/personal-blog/issues/1) の WordPress → EmDash 移行を検証するローカル PoC。**本番移行済みではありません。** 記事・画像・URL の実データ、編集者の操作、Cloudflare 上の復旧は後続の受入対象です。

- [実装計画](docs/plans/2026-10-09-issue-1.md)
- [検証結果と制約](docs/validation.md)
- [受入条件と最小必要入力](docs/acceptance-status.md)
- [棚卸し・受入・本番移行 runbook](docs/migration-runbook.md)

## 起動

macOS/Linux、mise 2026.10.4 以上、Node 24.20.0、npm 11.19.0 を検証済み。`mise.toml` と `package-lock.json` が固定バージョンの正本です。

```sh
mise trust
mise install
mise exec -- npm ci
mise exec -- npm run dev
```

`http://127.0.0.1:4321/` を一度開くとローカル D1 にスキーマができます。初回は記事 0 件です。管理画面は `http://127.0.0.1:4321/_emdash/admin/`。標準 passkey の初期設定は未実施で、今回の作業ではアカウントや鍵を作っていません。標準 CLI のリモート操作は開発用認証を自動利用する場合があるため、使わないでください。

合成記事を入れるには、サーバーを停止して実行します。

```sh
mise exec -- npx astro dev stop
mise exec -- npm run seed:local -- --server-stopped
mise exec -- npm run dev
mise exec -- npm run test:http
```

`seed:local` は初期化済みのローカル D1 が一つで、ユーザー数が 0 の場合だけ、公式のオフライン seed コマンドを呼びます。既存エントリーは skip します。実サイトの DB には使用しないでください。開発用の自動管理者作成ルートはこの PoC の Worker で拒否します。

## ローカル構成

Astro SSR + EmDash 1.2.0、ローカル D1/R2、認証セッション用のローカル KV。KV は Cloudflare アダプターが注入する `SESSION` binding で、公開記事のクエリキャッシュではありません。追加プラグイン、cron、Images サービス、メールは無効です。画像変換は passthrough、フォントはシステムフォントです。

公開側はトップ、記事、固定ページ、カテゴリ/タグ、404、RSS、EmDash 標準 sitemap。ページ送りは cursor 方式。管理 UI の言語候補は英語・日本語です。公開 URL は `/posts/{slug}/` 等の仮経路です。旧サイト URL の維持や 301 を検証済みと扱わないでください。

動的応答は `private, no-store` と `X-Robots-Tag: noindex`、robots は全拒否。Worker は localhost の HTTP 以外を拒否します。これらは公開検証環境の認証を代替しません。静的なビルド済み JS/CSS はアダプターの資産キャッシュ対象です。

## 検査

開発サーバーを停止してからビルド/型検査してください。並行すると Vite の依存キャッシュが競合する場合があります。

```sh
mise exec -- npx astro dev stop
mise run validate
# 個別には npm run format:check / npm test / npm run check / npm run build
```

ビルド済み Worker の HTTP 試験（別ターミナルで起動、終了は Ctrl-C）:

```sh
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=.private/logs mise exec -- npx wrangler dev --config dist/server/wrangler.json --local --ip 127.0.0.1 --port 4322 --persist-to .wrangler/state
# 別ターミナル:
POC_URL=http://127.0.0.1:4322 mise exec -- npm run test:http
```

## WXR の読み取り専用棚卸し

```sh
mise exec -- npm run inventory -- tests/fixtures/representative.xml
# 実 WXR は別途承認・安全な保管を済ませてから、パスのみ指定する。
```

結果は `.private/inventory.json` (0600) に保存します。同名ファイルがあれば失敗し、上書きしません。移動・保全してから再実行してください。終了コードは正常 0、入力/出力エラー 1、要確認の欠落/重複等あり 2。WXR 1.2 / 32 MiB まで。本文は保存せずハッシュ化しますが、タイトルや非公開 URL があるため結果全体を非公開として扱います。

画像の src/href は候補の列挙です。srcset、CSS、ショートコード内の参照は追加調査が必要です。ダウンロード、CMS インポート、公開状態の変換は行いません。別途 upstream Gutenberg 変換器の日本語・リンク・画像 alt・コード変換を合成データでテストしています。

## ローカル復旧

[runbook](docs/migration-runbook.md) の停止・保全手順に従います。snapshot は `.wrangler/state` 全体を別ディレクトリにコピーし、SHA-256 を照合します。復元は `.private/restored-state` へ行い、使用中の状態は上書きしません。これはローカルエミュレーター用で、本番 D1/R2 のバックアップ実装ではありません。

`dist/`、`.wrangler/`、`.private/`、実 WXR・SQL・DB・秘密情報はコミットしません。本番公開・DNS・課金資源・認証作成・push/PR は今回の作業範囲に含みません。
