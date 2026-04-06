export type EnvConfig = {
  openAI: OpenAiEnvConfig;
};

export type OpenAiEnvConfig = {
  apiKey: string;
  baseUrl: string;
  modal: string;
};
