import { logger } from "./logger";

/**
 * Global safety nets: log unhandled errors instead of crashing silently,
 * and exit cleanly on SIGINT/SIGTERM (Ctrl+C, docker stop).
 */
export function registerProcessHandlers() {
  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled promise rejection: ${reason}`);
  });

  process.on("uncaughtException", (error) => {
    logger.error(`Uncaught exception: ${error.stack ?? error.message}`);
  });

  const shutdown = (signal: string) => {
    logger.warn(`Received ${signal}, shutting down...`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
