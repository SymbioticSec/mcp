import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { getAllTools, MCPTool } from "./tools/index.js";
import { z } from "zod";

export const serverOptions = {
  name: "symbiotic-mcp-server",
  version: "1.0.0",
  capabilities: { resources: {}, tools: {} },
};

export const createMcpServer = () => {
  const server = new McpServer(serverOptions);
  initMcpTools(server);
  return server.server;
};

export const initMcpTools = (server: McpServer) => {
  const tools = getAllTools();

  tools.forEach((tool: MCPTool) => {
    const inputSchema = tool.inputSchema || z.object({});
    
    // Convert Zod schema to shape for MCP SDK
    const schemaShape = inputSchema instanceof z.ZodObject 
      ? inputSchema.shape 
      : {};
    
    const wrappedHandle = async (args: any, extra?: any) => {
      try {
        const validatedArgs = inputSchema.parse(args);
        return await tool.handle(validatedArgs);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ');
          
          return {
            content: [{
              type: "text" as const,
              text: `❌ Invalid input parameters for ${tool.name}: ${issues}`
            }],
            isError: true
          };
        }
        
        return {
          content: [{
            type: "text" as const, 
            text: `❌ Tool execution error: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    };
    
    server.tool(tool.name, tool.description, schemaShape, wrappedHandle);
  });
};

export class ServerList {
  private _servers: Server[] = [];
  private _serverFactory: () => Promise<Server>;

  constructor(serverFactory: () => Promise<Server>) {
    this._serverFactory = serverFactory;
  }

  async create() {
    const server = await this._serverFactory();
    this._servers.push(server);
    return server;
  }

  async close(server: Server) {
    const index = this._servers.indexOf(server);
    if (index !== -1) this._servers.splice(index, 1);
    await server.close();
  }

  async closeAll() {
    await Promise.all(this._servers.map((server) => server.close()));
  }
}