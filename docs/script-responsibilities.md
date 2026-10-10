# スクリプトの責務と操作範囲

対象は [Issue #1](https://github.com/yutaro1985/personal-blog/issues/1) のローカル PoC と [Draft PR #2](https://github.com/yutaro1985/personal-blog/pull/2)。  
承認された実装対象は以下の6ファイルと、対応するテスト・合成 fixture・手順書。  
実行時もリポジトリのルートを作業ディレクトリにする。

| 対象ファイル・責務                                                                         | 呼び出し元                                                         | 信頼境界・副作用と操作権限                                                                                                                                                                                                                       | エラーと試験                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/inventory.mjs`、`scripts/lib/inventory.mjs`：WXR の読み取り専用棚卸し             | `npm run inventory`、`tests/inventory*.test.mjs`                   | 未信頼 XML の DTD、構造、サイズを検査。外部取得や CMS 更新はしない。指定入力を読み、非公開 report を `.private/inventory.json` に排他的に作成する。実 WXR の取得・利用は別途許可が必要                                                           | 入出力エラーは終了1、要確認事項は2。既存出力を上書きせず、XML の内容を診断へ出さない。構造不正、状態、重複、特殊キー、非公開出力を自動試験                       |
| `scripts/seed-local.mjs`：公式 CLI による合成データ投入                                    | `npm run seed:local -- --server-stopped`                           | 停止済みで、初期化済み D1 が一つ、users が0件の場合だけ実行。`seed/seed.json` を読み、ローカル DB と `.private/seed-uploads` に書く。実 DB や認証作成の許可にはならない                                                                          | 確認引数・DB数・スキーマ・ユーザー条件を満たさなければ停止し、CLI の失敗を伝える。合成 seed の投入・再実行と HTTP 表示を手動検証。拒否分岐の自動試験は未実装     |
| `scripts/snapshot.mjs`、`scripts/lib/snapshot.mjs`：ローカル状態のコピー・整合性検査・復元 | runbook の `node scripts/snapshot.mjs`、`tests/snapshot*.test.mjs` | 停止確認引数が必須。backup は未コミット変更のない Git HEAD と lock/Node を記録し、`.wrangler/state` から指定の新規保存先へコピー。restore は保存済み state を新規 `.private/restored-state` にコピーする。現用状態の切替やクラウド操作は行わない | 既存保存先、symlink、空状態、ハッシュ不一致を拒否。CLI は失敗時に終了1。バイト列往復、上書き拒否、改ざん、特殊ファイル名、commit 記録、dirty/HEAD 不在を自動試験 |
| `scripts/smoke.mjs`：公開経路と境界の HTTP 検査                                            | `npm run test:http`                                                | `POC_URL` は localhost 系 hostname のみ。起動済み PoC へ GET を送る。アカウント作成や記事編集はしない                                                                                                                                            | status、本文、下書き非表示、no-store/noindex、親子分類、canonical/sitemap を assert。相違時は非0終了。標準 setup の到達をログイン成功とは扱わない                |

検証用データだけを `seed/` と `tests/fixtures/` に保存する。  
実 WXR、DB、バックアップ、report、ログは Git に含めない。  
snapshot の停止確認引数は利用者の申告であり、書き込みプロセスの自動検出ではない。

認証情報の作成、実データの取得、クラウド資源、本番公開、DNS、WordPress の変更・削除が必要になったら、操作前に利用者へ対象と必要な権限を確認する。  
保存先や復旧点が不明な場合、または書き込み結果を確認できない場合も、再実行せず利用者へ判断を戻す。  
通常の検証はサーバー停止後に `mise run validate`、HTTP 検査は [README](../README.md) の順序で行う。
