# personal-blog の作業境界

Issue #1 と `docs/plans/2026-10-09-issue-1.md` を起点にする。EmDash を使う方針で、現在の実装は Draft PR #2 のローカル PoC。実データの受入と本番移行の承認は別。

- `mise.toml` / exact npm dependencies / lockfile を使う。
- 検証用データだけを `seed/` と `tests/fixtures/` に保存する。実 WXR、SQL、DB、バックアップ、非公開 URL 対応表、トークンはコミットしない。
- 動的応答の no-store/noindex と localhost 限定を保つ。標準の開発用認証バイパスは利用しない。
- 認証情報、クラウド資源、本番公開、DNS 変更、WordPress の変更・削除は別途の明示的指示が必要。
- `astro dev` を止めてから `mise run validate`。ローカル HTTP 試験は `npm run test:http`。実認証を伴う未検証項目は未検証のまま報告する。
- `.emdash/migrations.json` と `emdash-env.d.ts` は EmDash 生成物。依存更新/スキーマ変更後に再生成と差分確認を行う。
