import test from "node:test";
import assert from "node:assert/strict";

import {
  createJobProgressUpdater,
  hasNoJobEvidence,
  NO_EVIDENCE_WATCHDOG_MS,
  shouldWatchForNoEvidence
} from "../plugins/codex/scripts/lib/tracked-jobs.mjs";
import { listJobs, readJobFile, resolveJobFile, upsertJob, writeJobFile } from "../plugins/codex/scripts/lib/state.mjs";
import { makeTempDir } from "./helpers.mjs";

test("no-evidence watchdog targets queued task jobs and requires unchanged log and phase", () => {
  assert.equal(NO_EVIDENCE_WATCHDOG_MS, 5 * 60 * 1000);
  assert.equal(shouldWatchForNoEvidence({ jobClass: "task", status: "queued" }), true);
  assert.equal(shouldWatchForNoEvidence({ jobClass: "task", status: "running" }), false);
  assert.equal(shouldWatchForNoEvidence({ jobClass: "review", status: "queued" }), false);

  const baseline = { logSize: 42, phase: "running" };
  assert.equal(hasNoJobEvidence(baseline, { ...baseline }), true);
  assert.equal(hasNoJobEvidence(baseline, { ...baseline, logSize: 43 }), false);
  assert.equal(hasNoJobEvidence(baseline, { ...baseline, phase: "editing" }), false);
});

test("late progress cannot overwrite a terminal job", () => {
  const workspaceRoot = makeTempDir();
  const jobId = "task-watchdog";
  const failedJob = {
    id: jobId,
    status: "failed",
    phase: "failed",
    summary: "no evidence after 5m — watchdog"
  };
  writeJobFile(workspaceRoot, jobId, failedJob);
  upsertJob(workspaceRoot, failedJob);

  createJobProgressUpdater(workspaceRoot, jobId)({
    message: "late progress",
    phase: "editing",
    threadId: "thr_late"
  });

  const storedJob = readJobFile(resolveJobFile(workspaceRoot, jobId));
  const indexedJob = listJobs(workspaceRoot).find((job) => job.id === jobId);
  assert.deepEqual(
    [storedJob.status, storedJob.phase, storedJob.summary, storedJob.threadId],
    ["failed", "failed", "no evidence after 5m — watchdog", undefined]
  );
  assert.deepEqual(
    [indexedJob.status, indexedJob.phase, indexedJob.summary, indexedJob.threadId],
    ["failed", "failed", "no evidence after 5m — watchdog", undefined]
  );
});

test("nonterminal progress persists without throwing", () => {
  const workspaceRoot = makeTempDir();
  const jobId = "task-running";
  const runningJob = { id: jobId, status: "running", phase: "starting" };
  writeJobFile(workspaceRoot, jobId, runningJob);
  upsertJob(workspaceRoot, runningJob);

  assert.doesNotThrow(() => {
    createJobProgressUpdater(workspaceRoot, jobId)({ message: "editing", phase: "editing" });
  });

  assert.equal(readJobFile(resolveJobFile(workspaceRoot, jobId)).phase, "editing");
  assert.equal(listJobs(workspaceRoot).find((job) => job.id === jobId).phase, "editing");
});
