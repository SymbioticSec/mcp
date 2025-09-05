import { spawn, ChildProcess } from "child_process";
import { config } from "./config.js";

export interface SymbioticCliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class SymbioticCliClient {
  private readonly cliPath: string;
  private readonly timeout: number;

  constructor(cliPath?: string, timeout?: number) {
    this.cliPath = cliPath ?? config.symbiotic.cliPath;
    this.timeout = timeout ?? config.symbiotic.processTimeout;
  }

  private async executeCommand(args: string[]): Promise<SymbioticCliResult> {
    return new Promise((resolve) => {
      const child: ChildProcess = spawn(this.cliPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let isResolved = false;

      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          child.kill("SIGKILL");
          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: `Command timed out after ${this.timeout}ms`,
            exitCode: 124, // Standard timeout exit code
          });
        }
      }, this.timeout);

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve({
            success: code === 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code || 0,
          });
        }
      });

      child.on("error", (error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: error.message,
            exitCode: 1,
          });
        }
      });
    });
  }

  async infraScan(path: string): Promise<SymbioticCliResult> {
    return this.executeCommand(["infra", "scan", path]);
  }

  async codeScan(path: string): Promise<SymbioticCliResult> {
    return this.executeCommand(["code", "scan", path]);
  }
}

export const getSymbioticClient = () => {
  return new SymbioticCliClient();
};