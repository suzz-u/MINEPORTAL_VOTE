#!/usr/bin/env node
/**
 * MinePortal 自動投票ツール
 *
 * https://mineportal.jp のサーバー詳細ページで、config.json に設定した MCID を使って
 * 自動投票します。投票は本物のページを Chrome で開いて「投票する」ボタンを押す方式なので、
 * サイト側の reCAPTCHA v3 もサイトの JS がそのまま実行します。
 *
 * 使い方:
 *   node index.js            … 常駐して intervalMinutes ごとに投票
 *   node index.js --once     … 1回だけ投票して終了 (タスクスケジューラ向け)
 *   node index.js --dry-run  … 投票ボタンは押さずに動作確認
 *   node index.js --headed   … 画面を表示して実行 (reCAPTCHA が厳しい場合)
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 実行ファイルの場所を返す。
 * - 通常実行 (node index.js)      … index.js のあるフォルダ
 * - 単一実行ファイル (Bun compile) … exe と同じフォルダ
 */
function resolveAppDir() {
  // Bun compile の仮想FS (POSIX: $bunfs / Windows: %7EBUN) では exe の場所を使う
  if (/\$bunfs|%7ebun|~bun/i.test(import.meta.url)) {
    return path.dirname(process.execPath);
  }
  return path.dirname(fileURLToPath(import.meta.url));
}

const APP_DIR = resolveAppDir();

/** 書き込み可能か確認する */
function isWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** config.json / プロファイル / ログの置き場所 (書けない場所ならホーム配下へ) */
const DATA_DIR = isWritable(APP_DIR)
  ? APP_DIR
  : (() => {
      const fallback = path.join(os.homedir(), ".mineportal-vote");
      fs.mkdirSync(fallback, { recursive: true });
      return fallback;
    })();

const CONFIG_PATH = process.env.MINEPORTAL_CONFIG
  ? path.resolve(process.env.MINEPORTAL_CONFIG)
  : path.join(DATA_DIR, "config.json");

const DEFAULT_CONFIG = {
  serverUrl: "https://mineportal.jp/servers/cmho85kzc0000g15izgsjnsr6",
  mcids: [],
  intervalMinutes: 60,
  dailyAt: "",
  retriesPerVote: 2,
  retryDelaySeconds: 30,
  betweenMcidDelaySeconds: 10,
  headless: true,
  channel: "chrome",
  executablePath: "",
  userDataDir: ".browser-profile",
  timeoutSeconds: 90,
  jitterSeconds: 0,
  dryRun: false,
  once: false,
  logFile: "vote.log",
  discordWebhookUrl: "",
};

// ---------------------------------------------------------------- logging

let logStream = null;

function timestamp() {
  return new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function log(level, message) {
  const line = `[${timestamp()}] [${level}] ${message}`;
  console.log(line);
  if (logStream) logStream.write(line + "\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------- config

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8");
    console.error(
      `config.json が見つからなかったため作成しました: ${CONFIG_PATH}\n` +
        `mcids を設定してから再実行してください。`
    );
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (err) {
    console.error(`config.json の読み込みに失敗しました: ${err.message}`);
    process.exit(1);
  }

  const cfg = { ...DEFAULT_CONFIG, ...raw };

  // mcids は文字列でも配列でも受け付ける
  const list = Array.isArray(cfg.mcids) ? cfg.mcids : [cfg.mcids];
  cfg.mcids = [...new Set(list.map((v) => String(v ?? "").trim()).filter(Boolean))];

  // 環境変数で上書き
  if (process.env.MINEPORTAL_MCID) {
    cfg.mcids = process.env.MINEPORTAL_MCID.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (process.env.MINEPORTAL_INTERVAL_MINUTES) {
    cfg.intervalMinutes = Number(process.env.MINEPORTAL_INTERVAL_MINUTES);
  }

  // コマンドライン引数
  if (process.argv.includes("--dry-run")) cfg.dryRun = true;
  if (process.argv.includes("--once")) cfg.once = true;
  if (process.argv.includes("--headed")) cfg.headless = false;
  if (process.argv.includes("--headless")) cfg.headless = true;

  cfg.serverUrl = String(cfg.serverUrl).trim();
  if (!/^https?:\/\/mineportal\.jp\/servers\/[A-Za-z0-9]+/.test(cfg.serverUrl)) {
    console.error(`serverUrl が不正です: ${cfg.serverUrl}`);
    process.exit(1);
  }
  cfg.intervalMinutes = Math.max(1, Number(cfg.intervalMinutes) || 60);
  cfg.timeoutMs = Math.max(15, Number(cfg.timeoutSeconds) || 90) * 1000;

  cfg.dailyAt = String(cfg.dailyAt ?? "").trim();
  if (cfg.dailyAt && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cfg.dailyAt)) {
    console.error(`dailyAt は "HH:MM" 形式で指定してください (例: "00:05"): ${cfg.dailyAt}`);
    process.exit(1);
  }

  return cfg;
}

// ---------------------------------------------------------------- browser

async function launchContext(cfg) {
  const userDataDir = path.resolve(DATA_DIR, cfg.userDataDir);
  fs.mkdirSync(userDataDir, { recursive: true });

  const options = {
    headless: !!cfg.headless,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1366, height: 900 },
    args: ["--disable-blink-features=AutomationControlled", "--lang=ja-JP"],
  };
  if (cfg.executablePath) {
    options.executablePath = cfg.executablePath;
  } else if (cfg.channel) {
    options.channel = cfg.channel;
  }

  log(
    "INFO",
    `Chrome を起動します (${cfg.headless ? "headless" : "headed"}${
      cfg.executablePath ? `, ${cfg.executablePath}` : `, channel=${cfg.channel}`
    })`
  );
  const context = await chromium.launchPersistentContext(userDataDir, options);
  context.setDefaultTimeout(cfg.timeoutMs);
  context.setDefaultNavigationTimeout(cfg.timeoutMs);

  // 自動化検知を少しやわらげる
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return context;
}

// ---------------------------------------------------------------- voting

/**
 * 1つの MCID で投票する。
 * @returns {Promise<{mcid: string, status: "success"|"cooldown"|"captcha-failed"|"error"|"dry-run", detail: string}>}
 */
async function castVote(context, cfg, mcid) {
  const page = await context.newPage();
  const result = { mcid, status: "error", detail: "" };

  try {
    await page.goto(cfg.serverUrl, { waitUntil: "domcontentloaded" });

    // サーバー詳細の「投票数」カードにある「投票する」ボタン
    const openButton = page.getByRole("button", { name: "投票する" }).first();
    await openButton.waitFor({ state: "visible" });
    await openButton.click();

    // 投票モーダル
    const dialog = page.locator("dialog.modal[open]").first();
    await dialog.waitFor({ state: "visible" });

    // MCID を入力 (React の制御コンポーネントなので fill で input イベントを発火)
    const input = dialog.locator("input").first();
    await input.fill(mcid);
    await page.waitForTimeout(600); // 文字数カウンタの更新待ち

    const counterUpdated =
      (await dialog.getByText(new RegExp(`${mcid.length}\\s*\\/\\s*16`)).count()) > 0;
    if (!counterUpdated) {
      result.detail = `MCID の入力が反映されていない可能性があります (入力値: ${await input.inputValue()})`;
    }

    if (cfg.dryRun) {
      result.status = "dry-run";
      result.detail = "dry-run のため投票ボタンは押していません";
      return result;
    }

    // 投票実行
    await dialog.getByRole("button", { name: "投票する" }).click();

    // 結果トースト (.toast .alert-success / .alert-error)
    const toast = page.locator(".toast .alert").first();
    await toast.waitFor({ state: "visible", timeout: cfg.timeoutMs });

    const classes = (await toast.getAttribute("class")) ?? "";
    const text = (await toast.innerText()).replace(/\s+/g, " ").trim();

    if (classes.includes("alert-success")) {
      result.status = "success";
      result.detail = text;
    } else if (/recaptcha/i.test(text)) {
      result.status = "captcha-failed";
      result.detail = text;
    } else if (/既に|投票済|時間後|日後|しばらく|クールダウン|cooldown|already/i.test(text)) {
      result.status = "cooldown";
      result.detail = text;
    } else {
      result.status = "error";
      result.detail = text;
    }
    return result;
  } catch (err) {
    result.detail = err?.message ? String(err.message).split("\n")[0] : String(err);
    return result;
  } finally {
    await page.close().catch(() => {});
  }
}

async function voteWithRetries(context, cfg, mcid) {
  const attempts = Math.max(1, Number(cfg.retriesPerVote) || 1);
  let last = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await castVote(context, cfg, mcid);
    if (last.status === "success" || last.status === "cooldown" || last.status === "dry-run") {
      return last;
    }
    if (attempt < attempts) {
      log(
        "WARN",
        `${mcid}: 失敗 (${last.status}) ${last.detail} → ${cfg.retryDelaySeconds}秒後に再試行 (${attempt}/${attempts})`
      );
      await sleep(Math.max(1, Number(cfg.retryDelaySeconds) || 30) * 1000);
    }
  }
  return last;
}

// ---------------------------------------------------------------- schedule

/** Asia/Tokyo での次回 HH:MM のタイムスタンプを返す */
function nextDailyAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const nowJst = new Date(Date.now() + JST_OFFSET);
  const targetJst = Date.UTC(
    nowJst.getUTCFullYear(),
    nowJst.getUTCMonth(),
    nowJst.getUTCDate(),
    h,
    m,
    0,
    0
  );
  let target = targetJst - JST_OFFSET;
  if (target <= Date.now()) target += 24 * 60 * 60 * 1000;
  return target;
}

function formatJst(ms) {
  return new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// ---------------------------------------------------------------- discord

async function notifyDiscord(cfg, results) {
  if (!cfg.discordWebhookUrl) return;

  const ok = results.filter((r) => r.status === "success").length;
  const icon = {
    success: "✅",
    cooldown: "⏳",
    "captcha-failed": "🤖",
    error: "❌",
    "dry-run": "🧪",
  };
  const description = results
    .map((r) => `${icon[r.status] ?? "❔"} \`${r.mcid}\`: ${r.detail || r.status}`)
    .join("\n")
    .slice(0, 3900);

  try {
    const res = await fetch(cfg.discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "MinePortal Vote",
        embeds: [
          {
            title: `MinePortal 自動投票 (${ok}/${results.length} 成功)`,
            description,
            color: ok > 0 ? 0x57f287 : 0xed4245,
            timestamp: new Date().toISOString(),
            footer: { text: cfg.serverUrl },
          },
        ],
      }),
    });
    if (!res.ok) log("WARN", `Discord 通知失敗: HTTP ${res.status}`);
  } catch (err) {
    log("WARN", `Discord 通知失敗: ${err.message}`);
  }
}

// ---------------------------------------------------------------- main

async function runCycle(context, cfg) {
  const results = [];

  for (let i = 0; i < cfg.mcids.length; i++) {
    const mcid = cfg.mcids[i];
    log("INFO", `${mcid} の投票を開始します...`);
    const result = await voteWithRetries(context, cfg, mcid);
    results.push(result);

    switch (result.status) {
      case "success":
        log("OK", `${mcid}: 投票成功 — ${result.detail}`);
        break;
      case "cooldown":
        log("SKIP", `${mcid}: 投票間隔中のためスキップ — ${result.detail}`);
        break;
      case "dry-run":
        log("TEST", `${mcid}: ドライラン完了 (投票は送信していません)`);
        break;
      case "captcha-failed":
        log("NG", `${mcid}: reCAPTCHA 検証に失敗 — ${result.detail}`);
        break;
      default:
        log("NG", `${mcid}: 投票失敗 — ${result.detail}`);
    }

    if (i < cfg.mcids.length - 1) {
      const delay = Math.max(0, Number(cfg.betweenMcidDelaySeconds) || 0);
      if (delay > 0) {
        log("INFO", `次の MCID まで ${delay} 秒待機します...`);
        await sleep(delay * 1000);
      }
    }
  }

  await notifyDiscord(cfg, results);
  return results;
}

async function main() {
  const cfg = loadConfig();

  if (cfg.mcids.length === 0 || cfg.mcids.some((m) => /^YOUR_MCID/i.test(m))) {
    console.error(
      `config.json の mcids に実際の MCID を設定してください。\n例: "mcids": ["Steve"]`
    );
    process.exit(1);
  }

  if (cfg.logFile) {
    logStream = fs.createWriteStream(path.resolve(DATA_DIR, cfg.logFile), {
      flags: "a",
      encoding: "utf8",
    });
  }

  log("INFO", "==================================================");
  log("INFO", "MinePortal 自動投票ツール 起動");
  log("INFO", `サーバー: ${cfg.serverUrl}`);
  log("INFO", `MCID: ${cfg.mcids.join(", ")}`);
  log("INFO", `モード: ${cfg.dryRun ? "ドライラン" : "本番"} / ${cfg.headless ? "headless" : "headed"}`);
  if (!cfg.once) {
    log(
      "INFO",
      cfg.dailyAt
        ? `実行スケジュール: 毎日 ${cfg.dailyAt} (JST)`
        : `実行間隔: ${cfg.intervalMinutes} 分`
    );
  }

  let context = null;
  try {
    context = await launchContext(cfg);
  } catch (err) {
    log("NG", `Chrome の起動に失敗しました: ${err.message}`);
    log("NG", "Google Chrome がインストールされているか、channel / executablePath の設定を確認してください。");
    process.exit(1);
  }

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    log("INFO", "停止します...");
    await context?.close().catch(() => {});
    logStream?.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    do {
      // 実行中だけ Chrome を開く（常駐中にプロファイルを占有しない）
      let results = [];
      try {
        if (!context) context = await launchContext(cfg);
        results = await runCycle(context, cfg);
      } catch (err) {
        log("NG", `実行に失敗しました: ${err?.message ?? err}`);
      } finally {
        await context?.close().catch(() => {});
        context = null;
      }

      const ok = results.filter((r) => r.status === "success").length;
      const skip = results.filter((r) => r.status === "cooldown" || r.status === "dry-run").length;
      const ng = results.length - ok - skip;
      log("INFO", `結果: 成功 ${ok} / スキップ ${skip} / 失敗 ${ng}`);

      if (cfg.once || cfg.dryRun) break;

      if (cfg.dailyAt) {
        const target = nextDailyAt(cfg.dailyAt);
        log("INFO", `次回実行: ${formatJst(target)} (毎日 ${cfg.dailyAt} JST)`);
        await sleep(Math.max(1000, target - Date.now()));
      } else {
        const base = cfg.intervalMinutes * 60_000;
        const jitter = Math.max(0, Number(cfg.jitterSeconds) || 0) * 1000;
        const waitMs = base + (jitter > 0 ? Math.floor(Math.random() * jitter * 2) - jitter : 0);
        log("INFO", `次回実行: ${formatJst(Date.now() + waitMs)}`);
        await sleep(waitMs);
      }
    } while (!stopping);
  } finally {
    logStream?.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
