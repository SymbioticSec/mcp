import { fileURLToPath } from 'url';
import { dirname, resolve, join, isAbsolute, normalize } from 'path';
import fs from 'fs';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';
import { config } from '../config.js';

export function getCurrentModuleDirectory(importMetaUrl: string): string {
  const __filename = fileURLToPath(importMetaUrl);
  return dirname(__filename);
}

export function getProjectRoot(startPath?: string): string {
  let currentDir = resolve(startPath || process.cwd());

  while (true) {
    const gitPath = join(currentDir, '.git');
    if (fs.existsSync(gitPath)) {
      return currentDir;
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) {
      return resolve(startPath || process.cwd());
    }
    currentDir = parent;
  }
}

export function detectProjectRootFromModule(importMetaUrl: string): string {
  const modDir = getCurrentModuleDirectory(importMetaUrl);
  return getProjectRoot(modDir);
}

export function getScanTargetDirectory(importMetaUrl?: string): string {
  const { paths } = config.getConfig();
  
  const editorProvided = paths.workingDir || paths.workspaceFolder || paths.projectDir;
  if (editorProvided && editorProvided.trim()) {
    return resolve(editorProvided);
  }

  const envTarget = paths.scanTarget;
  if (envTarget && envTarget.trim()) {
    return resolve(envTarget);
  }

  if (importMetaUrl) {
    return detectProjectRootFromModule(importMetaUrl);
  }

  return getProjectRoot();
}

export function getRelativeScanPath(targetPath: string, importMetaUrl?: string): string {
  const target = resolve(targetPath);
  const base = importMetaUrl ? detectProjectRootFromModule(importMetaUrl) : process.cwd();
  return resolve(target) === resolve(base) ? '.' : target;
}

export function safeJoin(baseDir: string, untrustedPath: string): string {
  const basePath = resolve(normalize(baseDir));

  if (!untrustedPath || untrustedPath === "." || untrustedPath.replace(/[/\\]/g, '') === "") {
    return basePath;
  }

  if (isAbsolute(untrustedPath)) {
    throw new Error("Untrusted path must be relative");
  }

  const fullPath = resolve(basePath, untrustedPath);

  if (!fullPath.startsWith(basePath + (basePath.endsWith('/') ? '' : '/'))) {
    throw new Error(`Untrusted path escapes the base directory: ${untrustedPath}`);
  }

  return fullPath;
}

export function validateAbsolutePath(pathToValidate: string, paramName: string = 'path'): string {
  if (!isAbsolute(pathToValidate)) {
    throw new Error(`${paramName} must be an absolute path`);
  }

  const normalizedPath = normalize(pathToValidate);
  const resolvedPath = resolve(normalizedPath);

  if (resolvedPath !== resolve(pathToValidate)) {
    throw new Error(`${paramName} contains invalid path traversal sequences`);
  }

  return resolvedPath;
}

export function getSecureScanTarget(importMetaUrl?: string): string {
  const targetPath = getScanTargetDirectory(importMetaUrl);
  return validateAbsolutePath(targetPath, 'scan target path');
}

export interface CodeFile {
  filename: string;
  content: string;
}

export function validateCodeFiles(codeFiles: CodeFile[]): CodeFile[] {
  if (!Array.isArray(codeFiles) || codeFiles.length === 0) {
    throw new Error("code_files must be a non-empty array");
  }

  for (const file of codeFiles) {
    if (!file.filename || typeof file.filename !== 'string') {
      throw new Error("Each code file must have a valid filename");
    }
    
    if (isAbsolute(file.filename)) {
      throw new Error("Filenames must be relative paths");
    }

    if (typeof file.content !== 'string') {
      throw new Error("Each code file must have string content");
    }
  }

  return codeFiles;
}

export async function createTempFilesFromCodeContent(codeFiles: CodeFile[]): Promise<string> {
  let tempDir: string | null = null;

  try {
    const { tempFiles } = config.getConfig();
    tempDir = await mkdtemp(join(tmpdir(), tempFiles.prefix));

    for (const file of codeFiles) {
      if (!file.filename) continue;

      const tempFilePath = safeJoin(tempDir, file.filename);

      try {
        await mkdir(dirname(tempFilePath), { recursive: true });

        await writeFile(tempFilePath, file.content, 'utf8');
      } catch (err: any) {
        throw new Error(`Failed to create or write file ${file.filename}: ${err.message}`);
      }
    }

    return tempDir;
  } catch (err: any) {
    if (tempDir) {
      const { tempFiles } = config.getConfig();
      if (tempFiles.cleanupOnError) {
        try {
          await rm(tempDir, { recursive: true });
        } catch {
        }
      }
    }
    throw new Error(`Failed to create temporary files: ${err.message}`);
  }
}

export function removeTempDirFromResults(results: string, tempDir: string): string {
  return results.replaceAll(tempDir + '/', '').replaceAll(tempDir, '.');
}