# 移行・受入 runbook

## 1. 現状調査 (未実施)

最初に元 WordPress の DB と uploads を安全な非公開保管先へバックアップし、復元可能性を確認する。WXR はバイナリを含まず、DB バックアップの代わりにならない。

| 調査                                                         | 必要なアクセス/提供物                    | 判定・成果物                                 |
| ------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------- |
| 投稿・固定ページ・カスタム投稿、状態、分類                   | 管理画面の読み取り/利用者による WXR 提供 | 件数、公開対象、除外理由                     |
| メディア容量、原本、alt、caption、外部参照                   | uploads の保全コピーと公開 HTML          | ファイル件数/ハッシュ/URL、外部依存          |
| パーマリンク、SEO、canonical、分類、ページ送り、feed、添付   | 公開サイト、設定の読み取り               | 旧 URL→維持/301/意図した削除の非公開対応表   |
| Gutenberg/Classic/独自HTML/コード/表/埋め込み/ショートコード | WXR と必要なプラグイン一覧               | 代表記事と変換時の手修正見積                 |
| コメント、フォーム、検索、解析、メール                       | 管理画面/設定の読み取り                  | 継続/廃止/代替と理由                         |
| DNS・メール・他サイトとレンタルサーバー依存                  | 契約者からの構成情報、DNS の読み取り     | 解約前の依存一覧                             |
| 性能                                                         | 同意した公開 URL・端末/回線・測定条件    | 同じ内容で TTFB/LCP/CLS/転送量、更新反映時間 |

現行ブログを今回の合成 seed から推測しない。公開ページだけでは全投稿数や非公開状態は確定できない。実データは `.private` またはリポジトリ外へ。Git ignore は暗号化やアクセス制限の代替ではない。

## 2. 代表記事の受入

現物から長文、日本語 slug、画像多め、表/コード/埋め込み/ショートコードのある 3〜5 本を選ぶ。不足する種類は追加。WXR で不足が確認できた場合にだけ Exporter 導入を相談する。

| 検証項目              | 記録と合格条件                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------- |
| 本文・分類・日時・SEO | 元 HTML と出力 HTML の差分。欠落、誤公開、意図しない日時変更なし                              |
| 画像                  | 元バイナリ、alt、caption、本文/アイキャッチの参照、公開経路を照合                             |
| 管理操作              | 日本語 IME、下書き、画像追加、preview、公開、変更、非公開化を編集者が PC/スマートフォンで完了 |
| 認証                  | 標準 passkey、端末紛失時の復旧。検証ドメインの passkey を本番へ流用しない                     |
| Preview               | 期限切れ、改ざん、別記事トークン、匿名での漏えいなし。トークンをログや Issue に貼らない       |
| 公開キャッシュ        | 採用時に記事/一覧/分類/RSS/sitemap の更新と非公開化を確認。PoC は未有効化                     |
| セキュリティ          | HTML/JS/埋め込みの実行境界、CSP、役割権限、native plugin の追加なし                           |
| 復旧                  | 空の検証 DB/バケットへ戻し、ログイン・編集・保存・画像・必要な暗号化設定を確認                |

WXR の private/future/pending を単純に published に変換しない。  
`publish` でもパスワード保護された記事は、通常公開の対象に含めず個別に確認する。  
棚卸しは `passwordProtected` と要確認事項 `password-protected` を記録し、パスワード自体は report に保存しない。  
元ローカル日時と GMT を保持し、サイトの timezone と照合してから変換する。slug のデコード回数、末尾 slash、重複、予約日時は別々に照合する。URL を推測して一括トップ転送しない。

今回の `/posts/{slug}/` は検証経路。実 URL が確定してからルートと SEO/canonical/sitemap の表現を揃える。スラッシュ強制を Astro 全体に設定すると EmDash の POST API の経路まで変わるため、公開ルートだけを対象に検証する。

## 3. ローカル復旧演習

サーバーと Wrangler をすべて停止する。snapshot 中に書き込みがあるコピーは受け入れない。次の操作はローカル合成状態専用。

```sh
mise exec -- npx astro dev stop
# wrangler dev はそのターミナルで Ctrl-C
mise exec -- node scripts/snapshot.mjs backup .private/backup-001 --server-stopped
mise exec -- node scripts/snapshot.mjs restore .private/backup-001 --server-stopped
```

backup 前に、実行するアプリの変更をコミットし、その checkout で起動・停止して状態を確定する。  
backup は Git HEAD がない場合と、追跡ファイルの変更・stage 済み変更・未追跡ファイルがある場合に、出力を作らず失敗する。  
Git 除外対象の `.wrangler/` や `.private/` はこの判定に含まれない。  
snapshot 中はコードも変更しない。

backup 先は新規ディレクトリのみ。  
DB/R2/KV を含む emulator 状態、各ファイルの SHA-256、作成時刻、`metadata.gitCommit`、`metadata.lockSha256`、Node バージョンを記録する。  
symlink を拒否し、ハッシュが違う復元は失敗する。  
これは破損検出であり署名付きバックアップではない。

復元は `.private/restored-state` にだけ行い、現用状態は変更しない。  
restore コマンドはファイルの整合性を確認するだけで、アプリの互換性判定や Git checkout は行わない。  
起動前に、manifest の `metadata.gitCommit` と一致する未コミット変更のない checkout を用意し、lockfile の SHA-256 と Node バージョンも照合する。  
commit の記録がない古いバックアップは対応コードが未特定なので、lockfile だけで互換性を判断せず、利用者に復旧点の確認を戻す。  
停止を再確認し、既存状態を `.private/pre-restore-001` など未使用の名前へ移動してから、復元済み state を `.wrangler/state` に配置する。  
上書きコピーはしない。

合成画像の往復試験:

```sh
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=.private/logs mise exec -- npx wrangler r2 object put personal-blog-local-media/fixture.svg --file tests/fixtures/media-probe.svg --content-type image/svg+xml --local
# バックアップ/復元後:
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=.private/logs mise exec -- npx wrangler r2 object get personal-blog-local-media/fixture.svg --file .private/restored-fixture.svg --local
cmp tests/fixtures/media-probe.svg .private/restored-fixture.svg
```

復元後、起動して `npm run test:http`。この演習ではアカウント未作成なのでログイン・編集復旧は未検証。R2 バイナリ検証と CMS の実画像インポートは別項目。

## 4. Cloudflare 上の復旧設計 (別途実施)

本番/検証は DB、R2、秘密情報を分離する。標準認証と Access は同じ認証モードとして混ぜない。検証環境はアクセス制限と noindex を併用する。Cloudflare の必要プラン/使用量/画像処理/メールを見積もってから資源作成を承認する。

EmDash 管理画面 JSON export は復旧用と扱わない。  
raw DB/SQL export または D1 の復旧点、同時点 R2 原本、アプリ commit/lock、秘密情報の保管先と鍵履歴を一組にする。  
バックアップは公開メディアと分離し、同じ障害範囲外にも保全する。

| 復旧方法          | 対象と検証                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| raw DB/SQL export | 空の検証 DB に取り込み、別バケットのメディアと合わせて起動・ログイン・編集を確認する                                     |
| D1 Time Travel    | 対象 DB 自体を指定時点へ巻き戻す。別 DB へのコピーではないため、専用の検証 DB と復旧前の保全・戻し手順を用意して実証する |

[D1 Time Travel の公式仕様](https://developers.cloudflare.com/d1/reference/time-travel/)に沿って、対象と操作の許可を確認してから実施する。  
実測後に RPO/RTO/保持期間/担当者を決定する。  
ローカル emulator コピーだけではクラウド D1/R2 復元の合格にはならない。

## 5. 全量リハーサル

1. 確定スナップショットの WXR と原本画像から検証環境へ取り込む。
2. 投稿種別/状態別の元件数、成功、除外理由、重複、失敗を記録する。
3. 全 URL を維持/個別301/意図した削除に対応付け、チェーン/ループを検査。画像/内部リンク/分類/ページ送り/feed/添付も対象。
4. 再取り込みの更新同期を仮定しない。基本は更新停止後の確定データから再構築。差分方式なら slug 変更・途中失敗・重複防止を先に実証。
5. 同じ端末/回線/内容・複数回・キャッシュ有無別で性能比較。基準値は測定前に合意。実ユーザー INP がなければ測定済みとしない。
6. 欠落/誤公開/復旧不能がないこと、手修正と残課題の扱いを承認してから次へ。

## 6. 本番切替・切り戻し (未承認)

- 事前: 更新停止時間、最終バックアップ、RPO/RTO、戻す条件、DNS TTL/切替手順、旧環境保持期間を合意。
- 切替: 確定データ、実ドメイン/認証、SEO、noindex解除範囲、キャッシュ破棄、DNS/ルーティングを担当者が確認し、別承認後に実施。
- 受入: 404/5xx、リンク/画像、更新反映、検索 index を監視。編集・画像追加・バックアップ/復旧を一巡。
- 切り戻し: EmDash への切替後の書き込みを保全・照合してから旧 WordPress へ戻す。新規記事を捨てない。
- 解約: メール/DNS/他サイト依存の解消と旧環境保持期間が満たされた後に判断。

一般利用者向けの実績として公開する際は、合成データの検証と当サイトの実データの結果を分け、特殊ブロックやプラグインのある他サイトへ一般化できない範囲を併記する。

## 一次資料 (2026-10-09 確認)

- [EmDash 1.2.0 release](https://github.com/emdash-cms/emdash/releases/tag/emdash%401.2.0)
- [Cloudflare 構成](https://docs.emdashcms.com/deployment/cloudflare/)
- [WordPress 移行](https://docs.emdashcms.com/migration/from-wordpress/)
- [バックアップ](https://docs.emdashcms.com/guides/backups/)
- [認証](https://docs.emdashcms.com/guides/authentication/)、[プレビュー](https://docs.emdashcms.com/guides/preview/)
