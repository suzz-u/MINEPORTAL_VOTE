# MinePortal 自動投票ツール

[mineportal.jp](https://mineportal.jp) のサーバー詳細ページで、`config.json` に設定した MCID を使って自動投票するツールです。

本物の Google Chrome で実際のページを開いて「投票する」ボタンを押す方式なので、ページ内の reCAPTCHA v3 もサイトの JavaScript がそのまま実行します（ヘッドレス Chrome で動作確認済み）。

対象サーバー: <https://mineportal.jp/servers/cmho85kzc0000g15izgsjnsr6>

---

## 配布版（単一実行ファイル）

Node.js 不要で動く単一実行ファイル版です。**Google Chrome は必要**です。
最新版は [GitHub Releases](https://github.com/suzz-u/MINEPORTAL_VOTE/releases/latest) からダウンロードできます。

| ファイル | 対応OS |
| --- | --- |
| `MINEPORTAL_AUTO_VOTE-windows-x64.zip` | Windows 10/11 (x64) |
| `MINEPORTAL_AUTO_VOTE-macos-arm64.zip` | macOS (Apple Silicon / M1〜) |
| `MINEPORTAL_AUTO_VOTE-macos-x64.zip` | macOS (Intel) |
| `MINEPORTAL_AUTO_VOTE-linux-x64.zip` | Linux (x64) |
| `MINEPORTAL_AUTO_VOTE-linux-arm64.zip` | Linux (arm64) |

### 使い方

1. 自分のOS用のzipを展開する
2. 初回は実行ファイルを起動 → 同じフォルダに `config.json` が自動生成されて終了する
3. `config.json` を開き、`mcids`（と必要なら `serverUrl`）を設定する
4. もう一度実行する（動作確認は `--dry-run` 推奨）

```
MINEPORTAL_AUTO_VOTE.exe --once --dry-run     # Windows (コマンドプロンプト)
./MINEPORTAL_AUTO_VOTE --once --dry-run       # macOS / Linux
```

引数なしで起動すると常駐モード（`config.json` のスケジュール）で動作します。

| 引数 | 内容 |
| --- | --- |
| なし | 常駐して `dailyAt` / `intervalMinutes` で投票 |
| `--once` | 1回だけ投票して終了（タスクスケジューラ / cron 向け） |
| `--dry-run` | 投票ボタンを押さずに動作確認 |
| `--headed` | Chrome の画面を表示して実行（reCAPTCHA が厳しいとき用） |

`config.json` / `.browser-profile` / `vote.log` は実行ファイルと同じフォルダに作られます。書き込めない場所（例: macOS の `/Applications`）に置いた場合は `~/.mineportal-vote/` に作られます。

### macOS での注意

- 実行権限を付ける: `chmod +x ./MINEPORTAL_AUTO_VOTE`
- ダウンロードしたファイルは Gatekeeper に引っかかるため、隔離属性を外す:
  `xattr -dr com.apple.quarantine ./MINEPORTAL_AUTO_VOTE`
- 本ビルドは **ad-hoc 署名**（Apple の Developer ID 署名・公証なし）です。上記の手順で実行できますが、配布する場合は Apple Developer Program での署名・公証を推奨します。

### Linux での注意

- 実行権限を付ける: `chmod +x ./MINEPORTAL_AUTO_VOTE`
- Google Chrome が必要（`google-chrome` コマンドが通る状態にする）

### Windows での注意

- 本ビルドは自己署名証明書（CN=Asterm Local Publisher、SHA-256 指紋 `208AD09DA104561A891F7793479FEA10CBF44071`）で署名されています。ファイルのプロパティでは発行元名が表示されますが、**SmartScreen の警告（発行元不明）は自己署名では回避できません。** 「詳細情報」→「実行」で起動できます。
- 日本語ログが文字化けする場合は `run.bat` から起動してください（コードページを UTF-8 に設定します）。

#### SmartScreen 警告を出さずに配布する方法

| 方法 | 費用 | 効果 |
| --- | --- | --- |
| そのまま許可してもらう | 0円 | 「詳細情報」→「実行」。`SHA256SUMS.txt` のハッシュ確認を案内する |
| `install.ps1`（PowerShell インストーラ） | 0円 | `irm https://raw.githubusercontent.com/suzz-u/MINEPORTAL_VOTE/main/install.ps1 \| iex` で導入。Invoke-WebRequest は Mark-of-the-Web を付けないため SmartScreen が出ない |
| Scoop / winget 経由で配布 | 0円 | パッケージマネージャのダウンローダは MOTW を付けないため警告が出ない |
| OV コード署名証明書 | 約$100〜/年 | 発行元名は表示されるが、SmartScreen の評価はダウンロード実績の蓄積が必要（即時ではない） |
| EV コード署名証明書 | 約$300〜/年 | SmartScreen の評価が即時付与される（確実に警告を消せる唯一の正規手段） |
| Azure Trusted Signing | 約$10/月 | Microsoft の署名サービス。審査（組織は3年以上の実績等）と対応地域の条件あり |
| SignPath Foundation / Certum Open Source | 0円〜約€25/年 | OSS 向け。公開リポジトリ・OSI ライセンス等の条件あり |

> 自己署名証明書を「信頼されたルート証明機関」に入れても SmartScreen は回避できません（UAC とプロパティの表示が変わるだけです）。

### 署名・検証について

- Windows: Authenticode 署名あり（自己署名・タイムスタンプ付き）
  - 署名者: `CN=Asterm Local Publisher` / 指紋: `208AD09DA104561A891F7793479FEA10CBF44071`
- macOS: ad-hoc 署名あり（Hardened Runtime + JIT エンタイトルメント、公証なし）
- Linux: 署名なし
- `SHA256SUMS.txt` に各ファイルの SHA-256 を記載しています。

> macOS / Linux 版は Windows 上からのクロスコンパイルのため、実機での動作確認は未実施です。不具合があれば `--headed` で実行してログを確認してください。

---

## 必要環境（Node.js 版 / 開発用）

- Node.js 18 以上（v24 で動作確認済み）
- Google Chrome（`channel: "chrome"` で使用。未インストールの場合は `executablePath` を指定）

## セットアップ（Node.js 版）

1. このフォルダを任意の場所に置く
2. `install.bat` をダブルクリック（npm install・config.json 作成・Chrome確認を自動実行）

コマンドで行う場合:

```powershell
cd MINEPORTAL_AUTO_VOTE
npm install
```

`config.json` を開いて `mcids` を書き換えます。

```json
{
  "serverUrl": "https://mineportal.jp/servers/cmho85kzc0000g15izgsjnsr6",
  "mcids": ["YourMCID"],
  "intervalMinutes": 60
}
```

統合版（Bedrock）の場合は `BE_(MCID)` の形式で入力します（サイトの仕様）。

## 実行（Node.js 版）

### batファイル（ダブルクリックでOK）

| ファイル | 内容 |
| --- | --- |
| `install.bat` | 初回セットアップ（npm install・設定確認・Chrome確認） |
| `dry-run.bat` | 動作確認。投票ボタンは押さない（送信されません） |
| `start.bat` | 常駐起動。起動時に1回試行し、以後は `config.json` のスケジュールで動く |
| `vote-once.bat` | 1回だけ投票して終了 |
| `register-task.bat` | Windowsタスクスケジューラに「毎日 00:05 (JST) に自動投票」を登録 |
| `unregister-task.bat` | 登録したタスクを削除 |

`start.bat`（常駐）とタスク登録はどちらか一方を使ってください。

### コマンドで実行する場合

| コマンド | 内容 |
| --- | --- |
| `npm start` | 常駐して `intervalMinutes` ごとに投票し続ける |
| `npm run once` | 1回だけ投票して終了（タスクスケジューラ向け） |
| `npm run dry-run` | 投票ボタンを押さずに入力までの動作を確認 |
| `npm run headed` | Chrome の画面を表示して実行（reCAPTCHA が厳しいとき用） |

ログはコンソールと `vote.log` に出力されます。

## 設定項目（config.json）

| キー | 既定値 | 説明 |
| --- | --- | --- |
| `serverUrl` | 対象サーバー | 投票するサーバー詳細ページのURL |
| `mcids` | – | 投票に使うMCID。配列で複数指定可（文字列1つでも可） |
| `intervalMinutes` | `60` | 常駐モードでの実行間隔（分）。`dailyAt` が空のとき有効 |
| `dailyAt` | `""` | `"00:05"` のように指定すると毎日その時刻 (JST) に実行。空なら `intervalMinutes` 間隔 |
| `retriesPerVote` | `2` | 1回の投票の試行回数（reCAPTCHA失敗時などに再試行） |
| `retryDelaySeconds` | `30` | 再試行までの待機秒数 |
| `betweenMcidDelaySeconds` | `10` | 複数MCIDを連続処理するときの間隔 |
| `headless` | `true` | `false` で画面表示（`--headed` と同じ） |
| `channel` | `"chrome"` | 使用ブラウザチャンネル。`"msedge"` も指定可 |
| `executablePath` | `""` | Chrome の exe を直接指定したい場合 |
| `userDataDir` | `".browser-profile"` | ブラウザプロファイル保存先（Cookie等を保持） |
| `timeoutSeconds` | `90` | 各操作のタイムアウト |
| `jitterSeconds` | `0` | 待機時間に加えるランダム揺らぎ（±秒） |
| `dryRun` | `false` | `true` で投票送信なし |
| `logFile` | `"vote.log"` | ログファイル。空文字で無効 |
| `discordWebhookUrl` | `""` | 結果を Discord Webhook に通知（任意） |

環境変数による上書きもできます。

- `MINEPORTAL_MCID` … `"MCID1,MCID2"` のようにカンマ区切り
- `MINEPORTAL_INTERVAL_MINUTES` … 実行間隔（分）
- `MINEPORTAL_CONFIG` … 別の config.json のパス

## 定期実行

### Windows タスクスケジューラ（Node.js 版）

`register-task.bat` をダブルクリックすると、毎日 00:05 (JST) に `index.js --once` を実行するタスク「MinePortalVote」が登録されます。PCが 00:05 に起動していなかった場合は、次に起動したときに実行されます（StartWhenAvailable）。削除は `unregister-task.bat`。

手動で登録する場合:

```powershell
schtasks /Create /TN "MinePortalVote" /SC DAILY /ST 00:05 ^
  /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\path\to\MINEPORTAL_AUTO_VOTE\index.js\" --once" ^
  /F
```

### cron（macOS / Linux）

```sh
# 毎日 00:05 (JST) に実行する例（サーバーのタイムゾーンが JST の場合）
5 0 * * * cd /path/to/MINEPORTAL_AUTO_VOTE && ./MINEPORTAL_AUTO_VOTE --once >> vote.log 2>&1
```

## 判定ロジック

投票後に表示されるトーストで結果を判定します。

- `alert-success`「サーバーに投票しました」→ 成功
- 「reCAPTCHA に失敗しました」→ 失敗（再試行）
- 「今日は既に投票しています。〜分後に試してください」等 → クールダウン中としてスキップ

mineportal.jp の投票は**毎日0時 (JST) にリセット**されることを確認済みです。そのため既定では `dailyAt: "00:05"` で毎日0時5分に投票します。起動時にも1回投票を試み、その後は毎日 `dailyAt` の時刻に実行します（PCが0:05に起動していなくても、次に起動した時点でその日の分を投票できます）。

`dailyAt` を使わず `intervalMinutes` で運用する場合は、60分間隔などにしておけばリセット前は自動でスキップされます。

## 注意

- 高頻度・大量アクセスはサーバーに負荷をかけ、規約上も問題になり得ます。常識的な間隔で運用してください。
- サイトの利用規約には自動化を名指しで禁止する条文はありませんが、「不適切に利用する一切の行為」等の包括条項で禁止扱いになり得ます。利用は自己責任で、まず運営（Discordサポート）に確認することを推奨します。
- reCAPTCHA v3 のスコアが原因で失敗が続く場合は `--headed`（画面表示）で実行すると改善することがあります。
- サイトの仕様変更でDOMが変わると動かなくなることがあります。その場合は `vote.log` のエラーを確認してセレクタ（`index.js` の `castVote`）を修正してください。

## ビルド方法（開発者向け）

単一実行ファイルは [Bun](https://bun.sh) の `bun build --compile` で作成しています。

```powershell
bun build --compile --minify --external chromium-bidi index.js `
  --outfile build/MINEPORTAL_AUTO_VOTE.exe --target=bun-windows-x64
```

- `--external chromium-bidi` … playwright-core の BiDi 専用コード（本ツールでは未使用）をバンドルしないための指定
- macOS 版はクロスコンパイル後に [rcodesign](https://github.com/indygreg/apple-platform-rs) で ad-hoc 署名しています

## ライセンス・免責

- ライセンス: [MIT License](LICENSE)
- 本ツールは **非公式** です。MinePortal およびその運営者とは一切関係がありません。
- 利用は自己責任でお願いします。詳細は [DISCLAIMER.md](DISCLAIMER.md) を参照してください。
