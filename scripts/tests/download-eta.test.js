// Run with: node --experimental-transform-types --test scripts/tests/download-eta.test.js
const assert = require("node:assert/strict");
const { createInstance } = require("i18next");
const { registerHooks } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      specifier = pathToFileURL(
        path.resolve(__dirname, "../../src", `${specifier.slice(2)}.ts`)
      ).href;
    }
    return nextResolve(specifier, context);
  },
});

const { formatTimeInterval } = require("../../src/utils/datetime.ts");
const {
  estimateDownloadGroupEta,
  getDownloadErrorText,
  getDownloadGroupProgress,
  getDownloadStats,
  shouldShowDownloadProgress,
} = require("../../src/utils/download.ts");
const { formatByteSize } = require("../../src/utils/string.ts");

test("a single modpack archive reports progress before the file completes", () => {
  assert.equal(
    getDownloadGroupProgress([
      {
        executor: "download",
        state: "downloading",
        total: 1000,
        received: 375,
      },
    ]),
    37.5
  );
});

test("group progress includes partial files and excludes installation steps", () => {
  assert.equal(
    getDownloadGroupProgress([
      { executor: "download", state: "done", total: 100, received: 100 },
      { executor: "download", state: "downloading", total: 100, received: 50 },
      { executor: "download", state: "pending", total: 100, received: 0 },
      { executor: "install", state: "pending" },
    ]),
    50
  );
});

test("unknown archive sizes stay indeterminate until a size or completion is known", () => {
  const archive = {
    executor: "download",
    state: "downloading",
    total: 0,
    received: 10,
  };
  assert.equal(getDownloadGroupProgress([archive]), undefined);
  assert.equal(getDownloadGroupProgress([{ ...archive, total: 20 }]), 50);
  assert.equal(getDownloadGroupProgress([{ ...archive, state: "done" }]), 100);
  assert.equal(getDownloadGroupProgress([]), undefined);
});

test("group progress stays bounded and follows a full-download restart", () => {
  const archive = {
    executor: "download",
    state: "downloading",
    total: 100,
    received: 90,
  };
  assert.equal(getDownloadGroupProgress([archive]), 90);
  assert.equal(getDownloadGroupProgress([{ ...archive, received: 10 }]), 10);
  assert.equal(getDownloadGroupProgress([{ ...archive, received: 150 }]), 100);
  assert.equal(getDownloadGroupProgress([{ ...archive, received: -10 }]), 0);
});

test("sub-KiB download rates never expose raw floating-point decimals", async () => {
  const { default: i18n } = await import("i18next");
  await i18n.init({
    lng: "en",
    resources: { en: { translation: require("../../src/locales/en.json") } },
  });
  assert.equal(formatByteSize(123.456789123), "123 B");
  assert.equal(formatByteSize(0.123456789123), "0 B");
  assert.equal(formatByteSize(1023.999999), "1024 B");
  assert.equal(formatByteSize(1536.789123), "1.50 KiB");
  assert.equal(formatByteSize(-1), "0 B");
  assert.equal(formatByteSize(Number.NaN), "0 B");
  assert.equal(formatByteSize(Number.POSITIVE_INFINITY), "0 B");
});

const makeTasks = (done, pending, extra = []) => [
  ...Array.from({ length: done }, () => ({
    executor: "download",
    state: "done",
  })),
  ...Array.from({ length: pending }, () => ({
    executor: "download",
    state: "pending",
  })),
  ...extra,
];

const makeKnownTasks = (done, pending) =>
  makeTasks(done, pending).map((task) => ({
    ...task,
    total: 100,
    received: 0,
  }));

test("fractional durations use whole seconds across minute and hour boundaries", () => {
  assert.equal(formatTimeInterval(0.123456789), "00:00:00");
  assert.equal(formatTimeInterval(59.999999), "00:00:59");
  assert.equal(formatTimeInterval(60.123456789), "00:01:00");
  assert.equal(formatTimeInterval(3599.999999), "00:59:59");
  assert.equal(formatTimeInterval(3600), "01:00:00");
});

test("small files have a group ETA without any per-file speed samples", () => {
  const initial = estimateDownloadGroupEta(
    "active",
    makeTasks(0, 100),
    undefined,
    0
  );
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(20, 80),
    initial.etaSample,
    2000
  );
  assert.equal(current.etaSecs, 8);
});

test("the completion estimate stays available while active files change", () => {
  const sample = { startedAt: 0, done: 0 };
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(20, 80),
    sample,
    2000
  );
  const next = estimateDownloadGroupEta(
    "active",
    makeTasks(25, 75),
    current.etaSample,
    2500
  );
  assert.equal(next.etaSecs, 8);
});

test("a slow active file sets a lower bound on the group ETA", () => {
  const tasks = makeTasks(20, 79, [
    {
      executor: "download",
      state: "downloading",
      received: 1,
      etaSecs: 30.123456789,
    },
  ]);
  const current = estimateDownloadGroupEta(
    "active",
    tasks,
    { startedAt: 0, done: 0 },
    2000
  );
  assert.equal(current.etaSecs, 31);
  assert.equal(formatTimeInterval(current.etaSecs), "00:00:31");
});

test("pausing clears the sample and resuming excludes earlier completions and idle time", () => {
  const tasks = makeTasks(20, 80);
  const paused = estimateDownloadGroupEta(
    "paused",
    tasks,
    {
      startedAt: 0,
      done: 0,
      received: 0,
      filesPerSec: 100,
      bytesPerSec: 10000,
    },
    2000
  );
  assert.equal(paused.etaSecs, undefined);
  assert.equal(paused.etaSample, undefined);
  const resumed = estimateDownloadGroupEta(
    "active",
    tasks,
    paused.etaSample,
    100000
  );
  assert.equal(resumed.etaSecs, undefined);
  assert.equal(resumed.etaSample.filesPerSec, undefined);
  assert.equal(resumed.etaSample.bytesPerSec, undefined);
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(30, 70),
    resumed.etaSample,
    101000
  );
  assert.equal(current.etaSecs, 7);
});

test("loading an active group counts only completions observed since loading", () => {
  const initial = estimateDownloadGroupEta(
    "active",
    makeTasks(50, 50),
    undefined,
    5000
  );
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(60, 40),
    initial.etaSample,
    7000
  );
  assert.equal(current.etaSecs, 8);
});

test("startup waits for a completion sample and keeps the per-file fallback", () => {
  const initial = estimateDownloadGroupEta(
    "active",
    makeTasks(0, 100),
    undefined,
    0
  );
  assert.equal(initial.etaSecs, undefined);
  assert.equal(
    estimateDownloadGroupEta("active", makeTasks(1, 99), initial.etaSample, 1)
      .etaSecs,
    undefined
  );
  const tasks = makeTasks(0, 0, [
    { executor: "download", state: "downloading", received: 1, etaSecs: 0.1 },
  ]);
  assert.equal(
    estimateDownloadGroupEta("active", tasks, undefined, 0).etaSecs,
    1
  );
});

test("installation and verification tasks do not affect file throughput", () => {
  const tasks = makeTasks(20, 80, [
    { executor: "prepare_install", state: "done" },
    { executor: "install", state: "pending" },
  ]);
  const current = estimateDownloadGroupEta(
    "active",
    tasks,
    { startedAt: 0, done: 0 },
    2000
  );
  assert.equal(current.etaSecs, 8);
  assert.equal(
    estimateDownloadGroupEta(
      "active",
      makeTasks(100, 0, [{ executor: "install", state: "downloading" }]),
      current.etaSample,
      10000
    ).etaSecs,
    undefined
  );
});

test("queued, draining, and finished groups clear estimates", () => {
  const tasks = makeTasks(1, 1, [
    { executor: "download", state: "downloading", etaSecs: 10 },
  ]);
  for (const state of ["queued", "draining", "finished"]) {
    const current = estimateDownloadGroupEta(
      state,
      tasks,
      { startedAt: 0, done: 0 },
      2000
    );
    assert.equal(current.etaSecs, undefined);
    assert.equal(current.etaSample, undefined);
  }
});

test("preparation and installation steps do not count as downloaded files", () => {
  const tasks = makeTasks(3, 1, [
    { executor: "prepare_install", state: "pending" },
    { executor: "install", state: "pending" },
    { executor: "verify", state: "pending" },
    { executor: "refresh_java", state: "pending" },
  ]);
  const stats = getDownloadStats(tasks);
  assert.equal(stats.total, 4);
  assert.equal(stats.done, 3);
  assert.equal(stats.pending, 1);
  assert.equal((stats.done * 100) / stats.total, 75);
});

test("download progress reaches 100 percent before postprocessing finishes", () => {
  const tasks = makeTasks(4, 0, [
    { executor: "prepare_install", state: "downloading" },
  ]);
  const stats = getDownloadStats(tasks);
  assert.equal(stats.total, 4);
  assert.equal(stats.done, 4);
  assert.equal(stats.downloading, 0);
  assert.equal((stats.done * 100) / stats.total, 100);
});

test("groups containing only installation steps have no download files", () => {
  const stats = getDownloadStats([
    { executor: "install", state: "downloading" },
    { executor: "verify", state: "pending" },
  ]);
  assert.equal(stats.total, 0);
  assert.equal(stats.done, 0);
  assert.equal(stats.downloading, 0);
  assert.equal(stats.pending, 0);
});

test("known queued file sizes contribute to the byte-based estimate", () => {
  const tasks = makeTasks(20, 0, [
    {
      executor: "download",
      state: "downloading",
      total: 1000,
      received: 100,
      speedBps: 100,
      etaSecs: 9,
    },
    {
      executor: "download",
      state: "downloading",
      total: 100,
      received: 50,
      speedBps: 50,
      etaSecs: 1,
    },
    { executor: "download", state: "pending", total: 1000, received: 0 },
  ]);
  const current = estimateDownloadGroupEta(
    "active",
    tasks,
    { startedAt: 0, done: 0 },
    2000
  );
  assert.equal(current.etaSecs, 13);
});

test("an almost complete known file is not inflated by earlier file completion times", () => {
  const tasks = makeTasks(100, 0, [
    {
      executor: "download",
      state: "downloading",
      total: 1000,
      received: 900,
      speedBps: 100,
      etaSecs: 1,
    },
  ]);
  const current = estimateDownloadGroupEta(
    "active",
    tasks,
    { startedAt: 0, done: 0 },
    100000
  );
  assert.equal(current.etaSecs, 1);
});

test("unknown queued files add work alongside known remaining bytes", () => {
  const tasks = makeTasks(20, 30, [
    {
      executor: "download",
      state: "downloading",
      total: 1000,
      received: 100,
      speedBps: 100,
      etaSecs: 9,
    },
  ]);
  const current = estimateDownloadGroupEta(
    "active",
    tasks,
    { startedAt: 0, done: 0 },
    2000
  );
  assert.equal(current.etaSecs, 12);
});

test("recent small-file throughput replaces a preceding slow phase", () => {
  const active = {
    executor: "download",
    state: "downloading",
    total: 1000,
    received: 500,
    speedBps: 100,
    etaSecs: 5,
  };
  const before = estimateDownloadGroupEta(
    "active",
    makeTasks(0, 100, [active]),
    { startedAt: 0, done: 0 },
    5000
  );
  const after = estimateDownloadGroupEta(
    "active",
    makeTasks(50, 50, [{ ...active, state: "done", received: 1000 }]),
    before.etaSample,
    6000
  );
  assert.equal(after.etaSecs, 1);
});

test("a slow connection still bounds the ETA when other transfers are fast", () => {
  const tasks = makeTasks(0, 0, [
    {
      executor: "download",
      state: "downloading",
      total: 1001,
      received: 1,
      speedBps: 10,
      etaSecs: 100,
    },
    {
      executor: "download",
      state: "downloading",
      total: 1001,
      received: 1,
      speedBps: 1000,
      etaSecs: 1,
    },
  ]);
  assert.equal(
    estimateDownloadGroupEta("active", tasks, undefined, 0).etaSecs,
    100
  );
});

test("a terminal failure clears ETA before the group state catches up", () => {
  const tasks = makeTasks(20, 80, [
    { executor: "download", state: "failed", retriesExhausted: true },
  ]);
  const current = estimateDownloadGroupEta(
    "active",
    tasks,
    { startedAt: 0, done: 0 },
    2000
  );
  assert.equal(current.etaSecs, undefined);
  assert.equal(current.etaSample, undefined);
});

test("failed and cancelled rows never show a waiting progress bar", () => {
  const group = { state: "active", finish: null };
  assert.equal(
    shouldShowDownloadProgress(group, {
      state: "failed",
      retriesExhausted: false,
    }),
    false
  );
  assert.equal(
    shouldShowDownloadProgress(group, {
      state: "failed",
      retriesExhausted: true,
    }),
    false
  );
  assert.equal(
    shouldShowDownloadProgress(group, { state: "cancelled" }),
    false
  );
});

test("stopped groups hide stale pending and downloading rows", () => {
  for (const group of [
    { state: "draining", finish: null },
    { state: "finished", finish: "failed" },
    { state: "finished", finish: "cancelled" },
    { state: "finished", finish: "completed" },
    { state: "active", finish: null, error: "HTTP 403" },
  ]) {
    assert.equal(shouldShowDownloadProgress(group), false);
    assert.equal(
      shouldShowDownloadProgress(group, { state: "pending" }),
      false
    );
    assert.equal(
      shouldShowDownloadProgress(group, { state: "downloading" }),
      false
    );
  }
});

test("pending work becomes visible again after a retry starts", () => {
  const group = { state: "active", finish: null };
  assert.equal(shouldShowDownloadProgress(group), true);
  assert.equal(shouldShowDownloadProgress(group, { state: "pending" }), true);
  assert.equal(
    shouldShowDownloadProgress(group, { state: "downloading" }),
    true
  );
  assert.equal(shouldShowDownloadProgress(group, { state: "verifying" }), true);
  assert.equal(shouldShowDownloadProgress(group, { state: "done" }), false);
});

const locales = ["en", "es", "fr", "ja", "lzh", "zh-Hans", "zh-Hant"];
const resources = Object.fromEntries(
  locales.map((locale) => [
    locale,
    { translation: require(`../../src/locales/${locale}.json`) },
  ])
);

const translator = (locale) => {
  const instance = createInstance();
  instance.init({
    lng: locale,
    resources,
    initImmediate: false,
    interpolation: { escapeValue: false },
  });
  return instance;
};

test("task and command errors share one translation contract", () => {
  const { t } = translator("en");
  for (const [error, expected] of [
    [{ code: "HTTP_ERROR", params: { status: 403 } }, "HTTP error: 403"],
    [
      { code: "NETWORK_ERROR", params: { details: "connection timed out" } },
      "Network error: connection timed out",
    ],
    [
      { code: "CORRUPT_FILES", params: { paths: ["a.jar", "b.jar"] } },
      "Corrupt files: a.jar and b.jar",
    ],
    [
      { code: "CHECKSUM_MISMATCH", params: { expected: "abc", actual: "def" } },
      "File checksum mismatch: expected abc, got def",
    ],
    [{ code: "OPTIFINE_MISSING" }, "OptiFine is missing"],
    [
      {
        code: "OTHER_ERROR",
        params: { details: "unexpected processor output" },
      },
      "Task failed: unexpected processor output",
    ],
    [
      { code: "UNKNOWN_GROUP", params: { groupId: "g1" } },
      "Task group g1 was not found",
    ],
    [
      { code: "INVALID_STATE", params: { groupId: "g1", state: "finished" } },
      "Task group g1 cannot perform this operation in its current state",
    ],
    [{ code: "EMPTY_GROUP" }, "A task group must contain at least one task"],
    [
      { code: "STORAGE_ERROR", params: { details: "disk full" } },
      "Failed to save download state: disk full",
    ],
    [new Error("IPC failure"), "Task failed: Error: IPC failure"],
  ]) {
    assert.equal(getDownloadErrorText(error, t), expected);
  }
  assert.equal(getDownloadErrorText(null, t), undefined);
});

test("all locales translate download errors and retain interpolation fields", () => {
  const reference = resources.en.translation.Services.task.common.description;
  const placeholders = (value) =>
    [...value.matchAll(/{{(\w+)(?:,[^}]*)?}}/g)]
      .map((match) => match[1])
      .sort();
  const params = {
    details: "disk full",
    status: 403,
    paths: ["a.jar", "b.jar"],
    expected: "abc",
    actual: "def",
    field: "url",
    executor: "test",
    groupId: "g1",
  };
  for (const locale of locales) {
    const { t } = translator(locale);
    const errors =
      resources[locale].translation.Services.task.common.description;
    assert.deepEqual(Object.keys(errors).sort(), Object.keys(reference).sort());
    for (const [code, value] of Object.entries(errors)) {
      assert.deepEqual(
        placeholders(value),
        placeholders(reference[code]),
        `${locale}: ${code}`
      );
      const text = getDownloadErrorText({ code, params }, t);
      assert.ok(
        text &&
          !text.includes("Services.task.common.description.") &&
          !text.includes("{{"),
        `${locale}: ${code}`
      );
    }
    for (const command of [
      "instance.createInstance",
      "instance.changeModLoader",
      "instance.changeOptiFine",
      "config.downloadMojangJava",
      "config.clearDownloadCache",
      "config.downloadLauncherUpdate",
      "resource.downloadGameServer",
      "resource.updateMods",
      "launch.validateGameFiles",
    ]) {
      assert.equal(
        t(`Services.${command}.error.description.DOWNLOAD_ENGINE_ERROR`),
        resources[locale].translation.Services.instance.createInstance.error
          .description.DOWNLOAD_ENGINE_ERROR,
        `${locale}: ${command}`
      );
    }
  }
});

test("an existing error is translated again after changing the language", () => {
  const instance = translator("en");
  const error = { code: "HTTP_ERROR", params: { status: 403 } };
  assert.equal(getDownloadErrorText(error, instance.t), "HTTP error: 403");
  instance.changeLanguage("zh-Hans");
  assert.equal(getDownloadErrorText(error, instance.t), "HTTP 错误：403");
});

test("known small files completing between ticks contribute byte throughput", () => {
  const knownTasks = (done, pending) =>
    makeTasks(done, pending).map((task) => ({
      ...task,
      total: 100,
      received: 0,
    }));
  const initial = estimateDownloadGroupEta(
    "active",
    knownTasks(0, 100),
    undefined,
    0
  );
  const current = estimateDownloadGroupEta(
    "active",
    knownTasks(20, 80),
    initial.etaSample,
    2000
  );
  assert.equal(current.etaSecs, 8);
});

test("the first positive throughput sample is used directly after an idle start", () => {
  const initial = estimateDownloadGroupEta(
    "active",
    makeKnownTasks(0, 100),
    undefined,
    0
  );
  const idle = estimateDownloadGroupEta(
    "active",
    makeKnownTasks(0, 100),
    initial.etaSample,
    1000
  );
  const current = estimateDownloadGroupEta(
    "active",
    makeKnownTasks(10, 90),
    idle.etaSample,
    2000
  );
  assert.equal(current.etaSample.filesPerSec, 10);
  assert.equal(current.etaSample.bytesPerSec, 1000);
  assert.equal(current.etaSecs, 9);
});

test("a completion burst is smoothed before calculating the group ETA", () => {
  const current = estimateDownloadGroupEta(
    "active",
    makeKnownTasks(40, 60),
    {
      startedAt: 0,
      done: 10,
      received: 1000,
      filesPerSec: 10,
      bytesPerSec: 1000,
    },
    1000
  );
  assert.ok(current.etaSample.filesPerSec > 15.66);
  assert.ok(current.etaSample.filesPerSec < 15.68);
  assert.ok(current.etaSample.bytesPerSec > 1566);
  assert.ok(current.etaSample.bytesPerSec < 1568);
  assert.equal(current.etaSecs, 4);
});

test("a brief gap between completions decays throughput instead of clearing ETA", () => {
  const current = estimateDownloadGroupEta(
    "active",
    makeKnownTasks(10, 90),
    {
      startedAt: 0,
      done: 10,
      received: 1000,
      filesPerSec: 10,
      bytesPerSec: 1000,
    },
    1000
  );
  assert.ok(current.etaSample.filesPerSec > 7.16);
  assert.ok(current.etaSample.filesPerSec < 7.17);
  assert.ok(current.etaSample.bytesPerSec > 716);
  assert.ok(current.etaSample.bytesPerSec < 717);
  assert.equal(current.etaSecs, 13);
});

test("throughput smoothing follows elapsed time across irregular update intervals", () => {
  const tasks = makeKnownTasks(10, 90);
  const sample = {
    startedAt: 0,
    done: 10,
    received: 1000,
    filesPerSec: 10,
    bytesPerSec: 1000,
  };
  const oneInterval = estimateDownloadGroupEta("active", tasks, sample, 3000);
  const first = estimateDownloadGroupEta("active", tasks, sample, 1000);
  const twoIntervals = estimateDownloadGroupEta(
    "active",
    tasks,
    first.etaSample,
    3000
  );
  assert.ok(oneInterval.etaSample.filesPerSec > 3.67);
  assert.ok(oneInterval.etaSample.filesPerSec < 3.68);
  assert.ok(oneInterval.etaSample.bytesPerSec > 367);
  assert.ok(oneInterval.etaSample.bytesPerSec < 368);
  assert.ok(
    Math.abs(
      oneInterval.etaSample.filesPerSec - twoIntervals.etaSample.filesPerSec
    ) < 1e-10
  );
  assert.ok(
    Math.abs(
      oneInterval.etaSample.bytesPerSec - twoIntervals.etaSample.bytesPerSec
    ) < 1e-10
  );
  assert.equal(oneInterval.etaSecs, 25);
  assert.equal(twoIntervals.etaSecs, 25);
});

test("retry progress resets discard the previous smoothed rates", () => {
  const reset = estimateDownloadGroupEta(
    "active",
    makeKnownTasks(10, 90),
    {
      startedAt: 0,
      done: 20,
      received: 2000,
      filesPerSec: 100,
      bytesPerSec: 10000,
    },
    1000
  );
  assert.equal(reset.etaSample.filesPerSec, undefined);
  assert.equal(reset.etaSample.bytesPerSec, undefined);
  const current = estimateDownloadGroupEta(
    "active",
    makeKnownTasks(20, 80),
    reset.etaSample,
    2000
  );
  assert.equal(current.etaSample.filesPerSec, 10);
  assert.equal(current.etaSample.bytesPerSec, 1000);
  assert.equal(current.etaSecs, 8);
});

test("a slow file still bounds ETA when smoothed group throughput is high", () => {
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(0, 0, [
      {
        executor: "download",
        state: "downloading",
        total: 1100,
        received: 100,
        speedBps: 10,
        etaSecs: 100,
      },
    ]),
    {
      startedAt: 0,
      done: 0,
      received: 0,
      filesPerSec: 100,
      bytesPerSec: 10000,
    },
    1000
  );
  assert.equal(current.etaSecs, 100);
});

test("missing byte samples fall back to file throughput for known queued sizes", () => {
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(20, 80).map((task) => ({
      ...task,
      received: 0,
      total: task.state === "done" ? 0 : 100000,
    })),
    { startedAt: 0, done: 0, received: 0 },
    2000
  );
  assert.equal(current.etaSecs, 8);
});

test("a connection without received bytes cannot inflate the group ETA", () => {
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(20, 79, [
      {
        executor: "download",
        state: "downloading",
        total: 100000,
        received: 0,
        speedBps: 8,
        etaSecs: 12500,
      },
    ]),
    { startedAt: 0, done: 0, received: 0 },
    2000
  );
  assert.equal(current.etaSecs, 8);
});

test("recent byte throughput accounts for queued large files without per-file speed ticks", () => {
  const smallTasks = (done, pending) =>
    makeTasks(done, pending).map((task) => ({
      ...task,
      total: 100,
      received: 0,
    }));
  const large = {
    executor: "download",
    state: "pending",
    total: 10000,
    received: 0,
  };
  const initial = estimateDownloadGroupEta(
    "active",
    [...smallTasks(0, 100), large],
    undefined,
    0
  );
  const current = estimateDownloadGroupEta(
    "active",
    [...smallTasks(20, 80), large],
    initial.etaSample,
    2000
  );
  assert.equal(current.etaSecs, 18);
});

test("queued files do not reuse an ETA from an earlier attempt", () => {
  const tasks = makeTasks(20, 10).map((task) => ({ ...task, etaSecs: 900 }));
  assert.equal(
    estimateDownloadGroupEta("active", tasks, { startedAt: 0, done: 0 }, 2000)
      .etaSecs,
    1
  );
});

test("ETAs of one day or more are hidden", () => {
  for (const seconds of [86400, 86401, 1e9]) {
    const tasks = [
      {
        executor: "download",
        state: "downloading",
        total: seconds + 1,
        received: 1,
        speedBps: 1,
        etaSecs: seconds,
      },
    ];
    assert.equal(
      estimateDownloadGroupEta("active", tasks, undefined, 0).etaSecs,
      undefined
    );
  }
});

test("the ETA limit applies after rounding to whole seconds", () => {
  const tasks = (seconds) => [
    {
      executor: "download",
      state: "downloading",
      total: seconds + 1,
      received: 1,
      speedBps: 1,
      etaSecs: seconds,
    },
  ];
  assert.equal(
    estimateDownloadGroupEta("active", tasks(86399), undefined, 0).etaSecs,
    86399
  );
  assert.equal(
    estimateDownloadGroupEta("active", tasks(86399.1), undefined, 0).etaSecs,
    undefined
  );
});

test("overflowing estimates are hidden and recover when speed improves", () => {
  const task = {
    executor: "download",
    state: "downloading",
    total: 1e10 + 1,
    received: 1,
    speedBps: 1e-300,
  };
  const initial = estimateDownloadGroupEta("active", [task], undefined, 0);
  assert.equal(initial.etaSecs, undefined);
  assert.ok(initial.etaSample);
  const current = estimateDownloadGroupEta(
    "active",
    [{ ...task, speedBps: 1e9 }],
    initial.etaSample,
    500
  );
  assert.equal(current.etaSecs, 10);
});

test("excessive unknown-file estimates are hidden", () => {
  const current = estimateDownloadGroupEta(
    "active",
    makeTasks(0, 100),
    { startedAt: 0, done: 0, filesPerSec: 0.001 },
    500
  );
  assert.equal(current.etaSecs, undefined);
});
