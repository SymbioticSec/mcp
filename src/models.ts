import { z } from "zod";

export const CodeFileSchema = z.object({
  filename: z.string().describe("Relative path to the file"),
  content: z.string().describe("Content of the file")
});

export const CodeWithLanguageSchema = z.object({
  code: z.string().describe("Code content to analyze"),
  language: z.string().default("javascript").describe("Programming language (defaults to javascript)")
});

export interface CodeFile {
  filename: string;
  content: string;
}

export interface CodeWithLanguage {
  code: string;
  language?: string;
}

export interface ScanResult {
  stdout: string;
  stderr?: string;
  exitCode?: number;
}

export interface SecurityFinding {
  rule_id: string;
  message: string;
  severity: string;
  file: string;
  line: number;
  column?: number;
}

export interface SecurityScanResult {
  version?: string;
  results: SecurityFinding[];
  errors: string[];
  scanned_paths: string[];
}