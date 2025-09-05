#!/usr/bin/env node
import { config } from "./config.js";
import { startHttpTransport, startStdioTransport } from "./transport.js";

async function main() {
  try {
    config.validateEnvironment();
    config.setEnvironmentVariables();

    if (config.isHttpMode()) {
      startHttpTransport(config.server.port!, config.server.hostname);
    } else {
      startStdioTransport();
    }
  } catch (error) {
    console.error("Fatal error in main():", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    process.exit(1);
  }
}

main();