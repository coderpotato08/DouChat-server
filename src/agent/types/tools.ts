export type ToolExecutionResponse = {
  toolName: string;
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
};
