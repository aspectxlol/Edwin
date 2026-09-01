import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";

export interface SystemStatus {
  uptime: number;

  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
    temperatureCelsius: number | null;
    loadAverage: number[];
  };

  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
  };

  disk: {
    path: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
  };

  os: {
    platform: string;
    release: string;
    architecture: string;
    hostname: string;
  };
}

interface CpuSnapshot {
  idle: number;
  total: number;
}

function getCpuSnapshot(): CpuSnapshot {
  const cpus = os.cpus();

  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;

    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.idle +
      cpu.times.irq;
  }

  return { idle, total };
}

function calculateCpuUsage(before: CpuSnapshot, after: CpuSnapshot): number {
  const idleDelta = after.idle - before.idle;
  const totalDelta = after.total - before.total;

  if (totalDelta === 0) {
    return 0;
  }

  return Number(((1 - idleDelta / totalDelta) * 100).toFixed(1));
}

async function getCpuUsage(): Promise<number> {
  const before = getCpuSnapshot();

  // Take two snapshots 100ms apart so we measure actual usage
  // instead of relying on a potentially stale value.
  await new Promise((resolve) => setTimeout(resolve, 100));

  const after = getCpuSnapshot();

  return calculateCpuUsage(before, after);
}

async function getDiskUsage(targetPath: string): Promise<{
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}> {
  // Node 22+ provides statfs().
  const stats = await fs.statfs(targetPath);

  const totalBytes = Number(stats.blocks) * Number(stats.bsize);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  const usedBytes = totalBytes - freeBytes;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
  };
}

async function getCpuTemperature(): Promise<number | null> {
  // Linux thermal sensors.
  if (process.platform !== "linux") {
    return null;
  }

  try {
    const thermalPath = "/sys/class/thermal";

    const entries = await fs.readdir(thermalPath);

    for (const entry of entries) {
      if (!entry.startsWith("thermal_zone")) {
        continue;
      }

      try {
        const type = (
          await fs.readFile(path.join(thermalPath, entry, "type"), "utf8")
        ).trim();

        const rawTemperature = (
          await fs.readFile(path.join(thermalPath, entry, "temp"), "utf8")
        ).trim();

        const temperature = Number(rawTemperature) / 1000;

        if (
          Number.isFinite(temperature) &&
          temperature > 0 &&
          temperature < 120
        ) {
          return Number(temperature.toFixed(1));
        }
      } catch {
        // Some thermal zones do not expose a readable temperature.
        continue;
      }
    }
  } catch {
    // /sys/class/thermal may not exist or may not be accessible.
  }

  return null;
}

export async function getLocalSystemStatus(): Promise<SystemStatus> {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  const cpuUsagePromise = getCpuUsage();
  const temperaturePromise = getCpuTemperature();
  const diskPromise = getDiskUsage(process.cwd());

  const [cpuUsage, temperature, disk] = await Promise.all([
    cpuUsagePromise,
    temperaturePromise,
    diskPromise,
  ]);

  return {
    uptime: os.uptime(),

    cpu: {
      model: os.cpus()[0]?.model ?? "Unknown",
      cores: os.cpus().length,
      usagePercent: cpuUsage,
      temperatureCelsius: temperature,
      loadAverage: os.loadavg(),
    },

    memory: {
      totalBytes: totalMemory,
      freeBytes: freeMemory,
      usedBytes: usedMemory,
      usagePercent: Number(((usedMemory / totalMemory) * 100).toFixed(1)),
    },

    disk: {
      path: process.cwd(),
      totalBytes: disk.totalBytes,
      freeBytes: disk.freeBytes,
      usedBytes: disk.usedBytes,
      usagePercent: Number(
        ((disk.usedBytes / disk.totalBytes) * 100).toFixed(1),
      ),
    },

    os: {
      platform: process.platform,
      release: os.release(),
      architecture: os.arch(),
      hostname: os.hostname(),
    },
  };
}
