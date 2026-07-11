import fs from "node:fs";
import process from "node:process";

import { readJobFile, resolveJobFile, resolveJobLogFile, upsertJob, writeJobFile } from "./state.mjs";

export const SESSION_ID_ENV = "CODEX_COMPANION_SESSION_ID";

export const NO_EVIDENCE_WATCHDOG_MS = 5 * 60 * 1000;

const NO_EVIDENCE_LOG_LINE = "watchdog: no evidence after 5m";
const NO_EVIDENCE_SUMMARY = "no evidence after 5m — watchdog";
const NO_EVIDENCE_ERROR_CODE = "ERR_CODEX_NO_EVIDENCE";
const TERMINAL_JOB_STATUSES = new Set(["completed", "failed", "cancelled"]);
const watchdogResetters = new Map();

export function nowIso() {
  return new Date().toISOString();
}

function normalizeProgressEvent(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      message: String(value.message ?? "").trim(),
      phase: typeof value.phase === "string" && value.phase.trim() ? value.phase.trim() : null,
      threadId: typeof value.threadId === "string" && value.threadId.trim() ? value.threadId.trim() : null,
      turnId: typeof value.turnId === "string" && value.turnId.trim() ? value.turnId.trim() : null,
      stderrMessage: value.stderrMessage == null ? null : String(value.stderrMessage).trim(),
      logTitle: typeof value.logTitle === "string" && value.logTitle.trim() ? value.logTitle.trim() : null,
      logBody: value.logBody == null ? null : String(value.logBody).trimEnd()
    };
  }

  return {
    message: String(value ?? "").trim(),
    phase: null,
    threadId: null,
    turnId: null,
    stderrMessage: String(value ?? "").trim(),
    logTitle: null,
    logBody: null
  };
}

export function appendLogLine(logFile, message) {
  const normalized = String(message ?? "").trim();
  if (!logFile || !normalized) {
    return;
  }
  fs.appendFileSync(logFile, `[${nowIso()}] ${normalized}\n`, "utf8");
}

export function appendLogBlock(logFile, title, body) {
  if (!logFile || !body) {
    return;
  }
  fs.appendFileSync(logFile, `\n[${nowIso()}] ${title}\n${String(body).trimEnd()}\n`, "utf8");
}

export function createJobLogFile(workspaceRoot, jobId, title) {
  const logFile = resolveJobLogFile(workspaceRoot, jobId);
  fs.writeFileSync(logFile, "", "utf8");
  if (title) {
    appendLogLine(logFile, `Starting ${title}.`);
  }
  return logFile;
}

export function createJobRecord(base, options = {}) {
  const env = options.env ?? process.env;
  const sessionId = env[options.sessionIdEnv ?? SESSION_ID_ENV];
  return {
    ...base,
    createdAt: nowIso(),
    ...(sessionId ? { sessionId } : {})
  };
}

export function createJobProgressUpdater(workspaceRoot, jobId) {
  let lastPhase = null;
  let lastThreadId = null;
  let lastTurnId = null;

  return (event) => {
    const storedJob = readStoredJobOrNull(workspaceRoot, jobId);
    if (TERMINAL_JOB_STATUSES.has(storedJob?.status)) {
      return;
    }

    const normalized = normalizeProgressEvent(event);
    const patch = { id: jobId };
    let changed = false;

    if (normalized.phase && normalized.phase !== lastPhase) {
      lastPhase = normalized.phase;
      patch.phase = normalized.phase;
      changed = true;
    }

    if (normalized.threadId && normalized.threadId !== lastThreadId) {
      lastThreadId = normalized.threadId;
      patch.threadId = normalized.threadId;
      changed = true;
    }

    if (normalized.turnId && normalized.turnId !== lastTurnId) {
      lastTurnId = normalized.turnId;
      patch.turnId = normalized.turnId;
      changed = true;
    }

    if (changed) {
      upsertJob(workspaceRoot, patch);

      if (storedJob) {
        writeJobFile(workspaceRoot, jobId, {
          ...storedJob,
          ...patch
        });
      }
    }

    for (const reset of watchdogResetters.get(`${workspaceRoot}\0${jobId}`) ?? []) {
      reset();
    }
  };
}

export function createProgressReporter({ stderr = false, logFile = null, onEvent = null } = {}) {
  if (!stderr && !logFile && !onEvent) {
    return null;
  }

  return (eventOrMessage) => {
    const event = normalizeProgressEvent(eventOrMessage);
    const stderrMessage = event.stderrMessage ?? event.message;
    if (stderr && stderrMessage) {
      process.stderr.write(`[codex] ${stderrMessage}\n`);
    }
    appendLogLine(logFile, event.message);
    appendLogBlock(logFile, event.logTitle, event.logBody);
    onEvent?.(event);
  };
}

function readStoredJobOrNull(workspaceRoot, jobId) {
  const jobFile = resolveJobFile(workspaceRoot, jobId);
  if (!fs.existsSync(jobFile)) {
    return null;
  }
  try {
    return readJobFile(jobFile);
  } catch {
    return null;
  }
}

export function persistFailedJob(workspaceRoot, jobId, patch = {}) {
  const failedPatch = {
    ...patch,
    status: "failed",
    phase: "failed",
    pid: null,
    completedAt: patch.completedAt ?? nowIso()
  };
  const storedJob = readStoredJobOrNull(workspaceRoot, jobId);
  if (storedJob) {
    writeJobFile(workspaceRoot, jobId, {
      ...storedJob,
      ...failedPatch
    });
  }
  upsertJob(workspaceRoot, { id: jobId, ...failedPatch });
  return failedPatch;
}

export function shouldWatchForNoEvidence(job) {
  return job?.jobClass === "task" && job?.status === "queued";
}

export function hasNoJobEvidence(previous, current) {
  return Boolean(previous && current) && previous.logSize === current.logSize && previous.phase === current.phase;
}

function readLogSize(logFile) {
  if (!logFile) {
    return null;
  }
  try {
    return fs.statSync(logFile).size;
  } catch {
    return null;
  }
}

function captureJobEvidence(workspaceRoot, jobId, logFile) {
  return {
    logSize: readLogSize(logFile),
    phase: readStoredJobOrNull(workspaceRoot, jobId)?.phase ?? null
  };
}

function startNoEvidenceWatchdog(job, logFile) {
  if (!shouldWatchForNoEvidence(job)) {
    return null;
  }

  const key = `${job.workspaceRoot}\0${job.id}`;
  let evidence = captureJobEvidence(job.workspaceRoot, job.id, logFile);
  let timer = null;
  let stopped = false;
  let rejectTimeout;
  const timeout = new Promise((_, reject) => {
    rejectTimeout = reject;
  });

  const reset = () => {
    if (stopped) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    evidence = captureJobEvidence(job.workspaceRoot, job.id, logFile);
    timer = setTimeout(() => {
      timer = null;
      const current = captureJobEvidence(job.workspaceRoot, job.id, logFile);
      if (!hasNoJobEvidence(evidence, current)) {
        reset();
        return;
      }
      appendLogLine(logFile, NO_EVIDENCE_LOG_LINE);
      const error = new Error(NO_EVIDENCE_SUMMARY);
      error.code = NO_EVIDENCE_ERROR_CODE;
      rejectTimeout(error);
    }, NO_EVIDENCE_WATCHDOG_MS);
  };

  const resetters = watchdogResetters.get(key) ?? new Set();
  resetters.add(reset);
  watchdogResetters.set(key, resetters);
  reset();

  return {
    timeout,
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
      resetters.delete(reset);
      if (resetters.size === 0) {
        watchdogResetters.delete(key);
      }
    }
  };
}

export async function runTrackedJob(job, runner, options = {}) {
  const runningRecord = {
    ...job,
    status: "running",
    startedAt: nowIso(),
    phase: "starting",
    pid: process.pid,
    logFile: options.logFile ?? job.logFile ?? null
  };
  writeJobFile(job.workspaceRoot, job.id, runningRecord);
  upsertJob(job.workspaceRoot, runningRecord);

  const watchdog = startNoEvidenceWatchdog(job, runningRecord.logFile);

  try {
    const executionPromise = runner();
    const execution = watchdog ? await Promise.race([executionPromise, watchdog.timeout]) : await executionPromise;
    const completionStatus = execution.exitStatus === 0 ? "completed" : "failed";
    const completedAt = nowIso();
    writeJobFile(job.workspaceRoot, job.id, {
      ...runningRecord,
      status: completionStatus,
      threadId: execution.threadId ?? null,
      turnId: execution.turnId ?? null,
      pid: null,
      phase: completionStatus === "completed" ? "done" : "failed",
      completedAt,
      result: execution.payload,
      rendered: execution.rendered
    });
    upsertJob(job.workspaceRoot, {
      id: job.id,
      status: completionStatus,
      threadId: execution.threadId ?? null,
      turnId: execution.turnId ?? null,
      summary: execution.summary,
      phase: completionStatus === "completed" ? "done" : "failed",
      pid: null,
      completedAt
    });
    appendLogBlock(options.logFile ?? job.logFile ?? null, "Final output", execution.rendered);
    return execution;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    persistFailedJob(job.workspaceRoot, job.id, {
      errorMessage,
      logFile: runningRecord.logFile,
      ...(error?.code === NO_EVIDENCE_ERROR_CODE ? { summary: NO_EVIDENCE_SUMMARY } : {})
    });
    throw error;
  } finally {
    watchdog?.stop();
  }
}
