import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const CODEXBAR_PATHS = ["/opt/homebrew/bin/codexbar", "/usr/local/bin/codexbar"];
const CODEXBAR_TIMEOUT_MS = 4000;
const RATE_LIMIT_KEYS = new Set([
  "atlimit",
  "isratelimited",
  "limitreached",
  "ratelimit",
  "ratelimited",
  "ratelimitreached"
]);

function codexbarPaths(env) {
  if (env.NODE_TEST_CONTEXT && env.CODEX_COMPANION_TEST_CODEXBAR) {
    return [env.CODEX_COMPANION_TEST_CODEXBAR];
  }
  return CODEXBAR_PATHS;
}

function normalizedKey(key) {
  return String(key).replace(/[-_]/g, "").toLowerCase();
}

function isRateLimitText(value) {
  return typeof value === "string" && /(?:rate|usage)[-_ ]?limit(?:ed|[_ -]?reached)?/i.test(value);
}

function hasRateLimitMarker(value) {
  if (Array.isArray(value)) {
    return value.some(hasRateLimitMarker);
  }
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, nested]) => {
    const normalized = normalizedKey(key);
    if (RATE_LIMIT_KEYS.has(normalized) && (nested === true || nested === 1 || isRateLimitText(nested))) {
      return true;
    }
    if (["code", "error", "reason", "state", "status"].includes(normalized) && isRateLimitText(nested)) {
      return true;
    }
    if (normalized === "ratelimit" && nested && typeof nested === "object") {
      return nested.reached === true || nested.limited === true || hasRateLimitMarker(nested);
    }
    return hasRateLimitMarker(nested);
  });
}

function normalizeResetTime(value) {
  const normalized = typeof value === "string" ? value.trim().replace(/^resets\s+/i, "") : "";
  return normalized || "unknown";
}

function findResetTime(value) {
  if (Array.isArray(value)) {
    return value.map(findResetTime).find((resetTime) => resetTime !== "unknown") ?? "unknown";
  }
  if (!value || typeof value !== "object") {
    return "unknown";
  }

  for (const [key, nested] of Object.entries(value)) {
    if (["resetat", "resetdescription", "resetsat", "resettime"].includes(normalizedKey(key))) {
      const resetTime = normalizeResetTime(nested);
      if (resetTime !== "unknown") {
        return resetTime;
      }
    }
  }
  return Object.values(value).map(findResetTime).find((resetTime) => resetTime !== "unknown") ?? "unknown";
}

function parseCodexUsage(stdout) {
  const parsed = JSON.parse(stdout);
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  const entry = entries.find((value) => value?.provider === "codex") ?? (entries.length === 1 ? entries[0] : null);
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const primary = entry?.usage?.primary;
  if (hasRateLimitMarker(entry)) {
    return {
      limited: true,
      resetTime: findResetTime(primary ?? entry)
    };
  }
  if (!primary || typeof primary !== "object") {
    return null;
  }

  const usedPercent = Number(primary.usedPercent);
  if (!Number.isFinite(usedPercent)) {
    return null;
  }

  return {
    limited: usedPercent >= 100,
    resetTime: normalizeResetTime(primary.resetDescription ?? primary.resetsAt)
  };
}

export function readCodexBudget(options = {}) {
  const env = options.env ?? process.env;
  const binaryPath = (options.binaryPaths ?? codexbarPaths(env)).find((candidate) => fs.existsSync(candidate));
  if (!binaryPath) {
    return null;
  }

  const result = (options.spawnSync ?? spawnSync)(
    binaryPath,
    ["usage", "--format", "json", "--provider", "codex"],
    {
      encoding: "utf8",
      env,
      timeout: CODEXBAR_TIMEOUT_MS,
      windowsHide: true
    }
  );
  if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
    return null;
  }

  try {
    return parseCodexUsage(result.stdout);
  } catch {
    return null;
  }
}

export function ensureCodexBudgetAvailable(options = {}) {
  const budget = readCodexBudget(options);
  if (budget?.limited) {
    throw new Error(`Codex at limit — resets ${budget.resetTime}; dispatch skipped`);
  }
}
