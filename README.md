# Symbiotic MCP Server

A Model Context Protocol (MCP) server for security analysis using Symbiotic CLI

## Description

This server exposes security analysis tools via the MCP protocol for any MCP-compatible client. It allows scanning code and infrastructure files without affecting your workspace.

### Available Tools

- **`code_scan_files`** - Static code analysis
- **`infra_scan_files`** - Infrastructure security scanning
- **`security_scan_files`** - Comprehensive security scan (code + infrastructure)
- **`get_supported_languages`** - List of supported programming languages

## Installation

1. **Install symbiotic-cli**

```bash
https://github.com/SymbioticSec/cli/releases
```

2. **Get API token**

Create an account on [Symbiotic Security](https://symbioticsec.ai) and retrieve your API token.

3. **Build and start**

Clone this repository and install dependencies:

```bash
npm install
npm run build
```

## MCP Configuration

In VSCode, open `MCP: Open User Configuration` and add in `servers`:

```json
{
 "servers": {
  "symbiotic-security": {
       "command": "node",
      "args": ["path/to/build/index.js"],
      "env": {
        "SYMBIOTIC_API_TOKEN": "your_token_here",
    }
  },
}
```

Configuration for other MCP clients may vary but generally follows the same structure.

```json
{
  "mcpServers": {
    "symbiotic-security": {
      "command": "node",
      "args": ["path/to/build/index.js"],
      "env": {
        "SYMBIOTIC_API_TOKEN": "your_token_here",
      }
    }
  }
}
```

**Important environment variables:**

- `SYMBIOTIC_API_TOKEN` *(required)* - Your Symbiotic API token

**Note:** Configuration file name and location may vary depending on your MCP client.

## Transport Modes

- **STDIO** (default) - Standard communication for MCP
- **SSE** - Server-Sent Events over HTTP
- **Streamable HTTP** - HTTP with `/mcp` endpoint

```bash
# STDIO (default)
node build/index.js

# HTTP server on port 9593
SERVER_PORT=9593 node build/index.js
```

## Authentication

The server requires a valid Symbiotic Security API token. Configuration is done via MCP environment variables.

**Minimal required configuration:**

```json
"env": {
  "SYMBIOTIC_API_TOKEN": "your_token_here"
}
```

## How It Works

1. Receives code files via MCP
2. Creates temporary files
3. Executes `symbiotic-cli`
4. Automatic cleanup of temporary files
5. Returns formatted results
