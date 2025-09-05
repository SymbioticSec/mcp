import { z } from "zod";

const ConfigSchema = z.object({
  server: z.object({
    mode: z.enum(["stdio", "http"]).default("stdio"),
    port: z.number().int().min(1).max(65535).optional(),
    hostname: z.string().default("0.0.0.0"),
  }),
  symbiotic: z.object({
    cliPath: z.string().min(1).default("symbiotic-cli"),
    targetApi: z.string().url().default("https://api.symbioticsec.ai"),
    apiToken: z.string().min(1).optional(),
    isOnline: z.boolean().default(true),
    processTimeout: z.number().int().min(1000).default(300000), // 5 minutes
  }),
  paths: z.object({
    workingDir: z.string().optional(),
    workspaceFolder: z.string().optional(),
    scanTarget: z.string().optional(),
    projectDir: z.string().optional(),
  }),
  tempFiles: z.object({
    prefix: z.string().default("symbiotic_mcp_"),
    cleanupOnError: z.boolean().default(true),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private validated = false;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): AppConfig {
    const rawConfig = {
      server: {
        mode: (process.env.SERVER_MODE || "stdio") as "stdio" | "http",
        port: process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : undefined,
        hostname: process.env.SERVER_HOSTNAME || "0.0.0.0",
      },
      symbiotic: {
        cliPath: process.env.SYMBIOTIC_CLI_PATH?.trim() || "symbiotic-cli",
        targetApi: process.env.SYMBIOTIC_TARGET_API?.trim() || "https://api.symbioticsec.ai",
        apiToken: process.env.SYMBIOTIC_API_TOKEN?.trim(),
        isOnline: process.env.SYMBIOTIC_IS_ONLINE !== "false",
        processTimeout: process.env.SYMBIOTIC_PROCESS_TIMEOUT 
          ? parseInt(process.env.SYMBIOTIC_PROCESS_TIMEOUT, 10) 
          : 300000,
      },
      paths: {
        workingDir: process.env.MCP_WORKING_DIR?.trim(),
        workspaceFolder: process.env.WORKSPACE_FOLDER?.trim(),
        scanTarget: process.env.MCP_SCAN_TARGET?.trim() || process.env.SCAN_TARGET?.trim(),
        projectDir: process.env.PROJECT_DIR?.trim(),
      },
      tempFiles: {
        prefix: process.env.SYMBIOTIC_TEMP_PREFIX?.trim() || "symbiotic_mcp_",
        cleanupOnError: process.env.SYMBIOTIC_CLEANUP_ON_ERROR !== "false",
      },
    };

    return rawConfig;
  }

  public validate(): void {
    if (this.validated) return;

    try {
      this.config = ConfigSchema.parse(this.config);
      this.validated = true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        throw new Error(`Configuration validation failed: ${issues}`);
      }
      throw error;
    }
  }

  public getConfig(): AppConfig {
    if (!this.validated) {
      this.validate();
    }
    return this.config;
  }

  public get server() {
    return this.getConfig().server;
  }

  public get symbiotic() {
    return this.getConfig().symbiotic;
  }

  public get paths() {
    return this.getConfig().paths;
  }

  public get tempFiles() {
    return this.getConfig().tempFiles;
  }

  public isHttpMode(): boolean {
    return this.server.mode === "http" && this.server.port !== undefined;
  }

  public requiresApiToken(): boolean {
    return this.symbiotic.isOnline && !this.symbiotic.apiToken;
  }

  public validateEnvironment(): void {
    this.validate();
    
    if (this.requiresApiToken()) {
      throw new Error("SYMBIOTIC_API_TOKEN environment variable is required when running in online mode");
    }

    if (this.isHttpMode() && !this.server.port) {
      throw new Error("SERVER_PORT must be specified when running in HTTP mode");
    }
  }

  public setEnvironmentVariables(): void {
    process.env.SYMBIOTIC_IS_ONLINE = this.symbiotic.isOnline.toString();
    process.env.SYMBIOTIC_TARGET_API = this.symbiotic.targetApi;
    
    if (this.symbiotic.apiToken) {
      process.env.SYMBIOTIC_API_TOKEN = this.symbiotic.apiToken;
    }
  }

  public toString(): string {
    const config = this.getConfig();
    const safeConfig = {
      ...config,
      symbiotic: {
        ...config.symbiotic,
        apiToken: config.symbiotic.apiToken ? "[REDACTED]" : undefined,
      },
    };
    return JSON.stringify(safeConfig, null, 2);
  }
}

export const config = ConfigManager.getInstance();