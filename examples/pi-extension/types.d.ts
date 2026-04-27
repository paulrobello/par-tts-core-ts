declare module "@mariozechner/pi-coding-agent" {
  export interface AgentToolTextContent {
    type: "text";
    text: string;
  }

  export interface AgentToolResult<TDetails = unknown> {
    content: AgentToolTextContent[];
    details?: TDetails;
  }

  export interface ToolDefinition<TParams = Record<string, unknown>, TDetails = unknown> {
    name: string;
    label: string;
    description: string;
    parameters: unknown;
    execute(toolCallId: string, params: TParams): Promise<AgentToolResult<TDetails>> | AgentToolResult<TDetails>;
  }

  export interface ExtensionAPI {
    registerTool<TParams = Record<string, unknown>, TDetails = unknown>(tool: ToolDefinition<TParams, TDetails>): void;
  }
}
