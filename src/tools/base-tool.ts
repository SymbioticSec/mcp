import { z } from "zod";
import { getSymbioticClient, SymbioticCliResult } from "../symbiotic-cli.js";
import { 
  validateCodeFiles, 
  createTempFilesFromCodeContent, 
  removeTempDirFromResults,
  CodeFile 
} from "../utils/paths.js";
import { formatSecurityResults } from "../utils/formatter.js";
import { rm } from 'fs/promises';

export interface MCPToolResponse {
  [x: string]: unknown;
  content: Array<{
    [x: string]: unknown;
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: z.ZodSchema;
  handle: (params: any) => Promise<MCPToolResponse>;
}

export type ScanType = 'code' | 'infra';
export type ScanOperation = (client: ReturnType<typeof getSymbioticClient>, tempDir: string) => Promise<SymbioticCliResult>;

export abstract class BaseScanTool implements MCPTool {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public readonly inputSchema: z.ZodSchema;

  constructor() {
    this.inputSchema = z.object({
      code_files: z.array(z.object({
        filename: z.string().describe("Relative path to the file"),
        content: z.string().describe("Content of the file")
      })).optional().describe("Array of code files to process"),
      codeFiles: z.array(z.object({
        filename: z.string().describe("Relative path to the file"),
        content: z.string().describe("Content of the file")
      })).optional().describe("Array of code files to process (alias)"),
      files: z.array(z.object({
        filename: z.string().describe("Relative path to the file"),
        content: z.string().describe("Content of the file")
      })).optional().describe("Array of code files to process (alias)")
    });
  }

  protected normalizeParams(params: any): CodeFile[] {
    return params.code_files || params.codeFiles || params.files || [];
  }

  protected async withTempDirectory<T>(
    codeFiles: CodeFile[],
    operation: (tempDir: string) => Promise<T>
  ): Promise<T> {
    let tempDir: string | null = null;
    
    try {
      const validatedCodeFiles = validateCodeFiles(codeFiles);
      tempDir = await createTempFilesFromCodeContent(validatedCodeFiles);
      return await operation(tempDir);
    } finally {
      if (tempDir) {
        try {
          await rm(tempDir, { recursive: true });
        } catch (cleanupError) {
          console.warn(`⚠️  Failed to cleanup temporary directory ${tempDir}:`, cleanupError);
        }
      }
    }
  }

  protected async executeScan(
    operation: ScanOperation, 
    tempDir: string,
    scanType: ScanType
  ): Promise<{ result: SymbioticCliResult; parsedOutput: any }> {
    const client = getSymbioticClient();
    const result = await operation(client, tempDir);
    
    if (result.exitCode !== 0) {
      throw new Error(`Symbiotic CLI ${scanType} scan failed (exit code ${result.exitCode}): ${result.stderr || result.stdout}`);
    }

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(result.stdout);
    } catch (parseError) {
      throw new Error(`Failed to parse Symbiotic CLI response: ${result.stdout}`);
    }

    return { result, parsedOutput };
  }

  protected formatScanResults(
    result: SymbioticCliResult, 
    tempDir: string, 
    scanType: ScanType
  ): string {
    const cleanedResults = removeTempDirFromResults(result.stdout, tempDir);
    const formattedResults = formatSecurityResults(cleanedResults, scanType);
    
    return formattedResults + (result.stderr ? `\n\n**Warnings:**\n${result.stderr}` : "");
  }

  protected createSuccessResponse(text: string): MCPToolResponse {
    return {
      content: [{
        type: "text" as const,
        text
      }]
    };
  }

  protected createErrorResponse(error: any): MCPToolResponse {
    return {
      content: [{
        type: "text" as const,
        text: `❌ Error executing ${this.name}: ${error?.message || String(error)}`
      }],
      isError: true
    };
  }

  public abstract handle(params: any): Promise<MCPToolResponse>;
}

export class SingleScanTool extends BaseScanTool {
  private readonly scanOperation: ScanOperation;
  private readonly scanType: ScanType;

  constructor(
    name: string,
    description: string,
    scanType: ScanType,
    scanOperation: ScanOperation
  ) {
    super();
    this.name = name;
    this.description = description;
    this.scanType = scanType;
    this.scanOperation = scanOperation;
  }

  public readonly name: string;
  public readonly description: string;

  async handle(params: any): Promise<MCPToolResponse> {
    try {
      const codeFiles = this.normalizeParams(params);
      
      return await this.withTempDirectory(codeFiles, async (tempDir) => {
        const { result } = await this.executeScan(this.scanOperation, tempDir, this.scanType);
        const formattedText = this.formatScanResults(result, tempDir, this.scanType);
        return this.createSuccessResponse(formattedText);
      });

    } catch (err: any) {
      return this.createErrorResponse(err);
    }
  }
}

export class MultiScanTool extends BaseScanTool {
  private readonly scanOperations: Array<{
    operation: ScanOperation;
    type: ScanType;
    label: string;
  }>;

  constructor(
    name: string,
    description: string,
    scanOperations: Array<{
      operation: ScanOperation;
      type: ScanType;
      label: string;
    }>
  ) {
    super();
    this.name = name;
    this.description = description;
    this.scanOperations = scanOperations;
  }

  public readonly name: string;
  public readonly description: string;

  async handle(params: any): Promise<MCPToolResponse> {
    try {
      const codeFiles = this.normalizeParams(params);
      
      return await this.withTempDirectory(codeFiles, async (tempDir) => {
        const scanPromises = this.scanOperations.map(async ({ operation, type, label }) => {
          try {
            const result = await operation(getSymbioticClient(), tempDir);
            return {
              type,
              label,
              result,
              success: result.exitCode === 0,
              error: null
            };
          } catch (error) {
            return {
              type,
              label,
              result: { 
                success: false, 
                stdout: `${label} error: ${error}`, 
                stderr: '', 
                exitCode: 1 
              } as SymbioticCliResult,
              success: false,
              error: error
            };
          }
        });

        const scanResults = await Promise.all(scanPromises);

        let resultText = `✅ Comprehensive security scan completed on ${codeFiles.length} files\n\n`;
        
        const warnings: string[] = [];
        
        scanResults.forEach(({ type, label, result, success, error }, index) => {
          if (index > 0) resultText += `\n\n---\n\n`;
          
          resultText += this.formatScanResults(result, tempDir, type);
          
          if (result.stderr) warnings.push(`${label} warnings: ${result.stderr}`);
          if (result.exitCode !== 0) warnings.push(`${label} failed with exit code ${result.exitCode}`);
        });
        
        if (warnings.length > 0) {
          resultText += `\n\n**Warnings:**\n${warnings.join('\n')}`;
        }
        
        return this.createSuccessResponse(resultText);
      });

    } catch (err: any) {
      return this.createErrorResponse(err);
    }
  }
}

export class SimpleResponseTool implements MCPTool {
  public readonly name: string;
  public readonly description: string;
  public readonly inputSchema: z.ZodSchema;
  private readonly responseGenerator: () => Promise<string> | string;

  constructor(
    name: string,
    description: string,
    inputSchema: z.ZodSchema,
    responseGenerator: () => Promise<string> | string
  ) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.responseGenerator = responseGenerator;
  }

  async handle(params: any): Promise<MCPToolResponse> {
    try {
      const text = await this.responseGenerator();
      return {
        content: [{
          type: "text" as const,
          text
        }]
      };
    } catch (err: any) {
      return {
        content: [{
          type: "text" as const,
          text: `❌ Error executing ${this.name}: ${err?.message || String(err)}`
        }],
        isError: true
      };
    }
  }
}