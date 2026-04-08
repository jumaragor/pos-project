const ENABLE_TIMING_LOGS = process.env.PERF_DEBUG === "true";

export function startPerfTimer(label: string) {
  const startedAt = performance.now();

  return {
    end(meta?: Record<string, unknown>) {
      if (!ENABLE_TIMING_LOGS) return;
      const elapsed = Math.round((performance.now() - startedAt) * 100) / 100;
      const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
      console.info(`[perf] ${label} ${elapsed}ms${suffix}`);
    }
  };
}
