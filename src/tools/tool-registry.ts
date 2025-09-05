import { z } from "zod";
import { SingleScanTool, MultiScanTool, SimpleResponseTool, MCPTool } from "./base-tool.js";

const codeScan = new SingleScanTool(
  "code_scan_files",
  "Run Symbiotic CLI code analysis on provided code files - creates temporary files, scans them, and cleans up. Ideal for analyzing code snippets or specific files for security vulnerabilities without affecting the workspace.",
  "code",
  async (client, tempDir) => client.codeScan(tempDir)
);

const infraScan = new SingleScanTool(
  "infra_scan_files", 
  "Run Symbiotic CLI infrastructure security scanner on provided files - creates temporary files, scans them, and cleans up. Ideal for analyzing Dockerfiles, Kubernetes manifests, Terraform configs, and other infrastructure-as-code files without affecting the workspace.",
  "infra",
  async (client, tempDir) => client.infraScan(tempDir)
);

const securityScan = new MultiScanTool(
  "security_scan_files",
  "Comprehensive security scan using Symbiotic CLI on provided files - creates temporary files, runs both code and infrastructure security analysis, and cleans up. Perfect for complete security analysis of code snippets and infrastructure files.",
  [
    {
      operation: async (client, tempDir) => client.codeScan(tempDir),
      type: "code",
      label: "Code scan"
    },
    {
      operation: async (client, tempDir) => client.infraScan(tempDir), 
      type: "infra",
      label: "Infra scan"
    }
  ]
);

const supportedLanguages = new SimpleResponseTool(
  "get_supported_languages",
  "Returns comprehensive list of programming languages supported by Symbiotic CLI security scanners for both code and infrastructure analysis",
  z.object({}),
  () => {
    const languages = [
      "javascript",
      "typescript", 
      "python",
      "java",
      "go",
      "rust",
      "php",
      "ruby",
      "csharp",
      "cpp",
      "c",
      "swift",
      "kotlin",
      "scala",
      "dockerfile",
      "yaml",
      "json",
      "xml",
      "html",
      "css"
    ];
    
    return `✅ Supported languages:\n\n${languages.join('\n')}`;
  }
);

export const TOOLS: MCPTool[] = [
  codeScan,
  infraScan,
  securityScan,
  supportedLanguages
];

export function getToolByName(name: string): MCPTool | undefined {
  return TOOLS.find(tool => tool.name === name);
}

export function getAllTools(): MCPTool[] {
  return [...TOOLS];
}