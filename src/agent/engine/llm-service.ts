import OpenAI from "openai";
import { EnvConfig, LlmProviderName } from "../types/agent";

type ProviderDefinition = {
  name: LlmProviderName;
  envPrefix: string;
};

export type LlmClientBundle = {
  client: OpenAI;
  config: EnvConfig["openAI"];
  provider: LlmProviderName;
};

const PROVIDERS: ProviderDefinition[] = [
  {
    name: "DOUBAO",
    envPrefix: "OPENAI_DOUBAO",
  },
  {
    name: "QWEN",
    envPrefix: "OPENAI_QWEN",
  },
];

export class LlmService {
  private readonly providerMap = new Map<LlmProviderName, ProviderDefinition>(
    PROVIDERS.map((provider) => [provider.name, provider]),
  );
  private readonly clientCache = new Map<LlmProviderName, OpenAI>();

  private readProviderConfig(envPrefix: string): EnvConfig["openAI"] | null {
    const apiKey = process.env[`${envPrefix}_API_KEY`];
    const baseUrl = process.env[`${envPrefix}_BASE_URL`];
    const model = process.env[`${envPrefix}_MODEL`] || process.env[`${envPrefix}_DEFAULT_MODAL`];

    if (!apiKey || !baseUrl || !model) {
      return null;
    }

    return {
      apiKey,
      baseUrl,
      model,
    };
  }

  private resolveProviderConfig(provider: LlmProviderName): EnvConfig["openAI"] {
    const providerDefinition = this.providerMap.get(provider);
    if (!providerDefinition) {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    const config = this.readProviderConfig(providerDefinition.envPrefix);
    if (!config) {
      throw new Error(
        `LLM provider ${provider} is not configured. Please check ${providerDefinition.envPrefix}_API_KEY, ${providerDefinition.envPrefix}_BASE_URL and ${providerDefinition.envPrefix}_MODEL or ${providerDefinition.envPrefix}_DEFAULT_MODAL.`,
      );
    }

    return config;
  }

  public getClientBundle(provider: LlmProviderName): LlmClientBundle {
    const config = this.resolveProviderConfig(provider);
    const cachedClient = this.clientCache.get(provider);

    if (cachedClient) {
      return {
        provider,
        config,
        client: cachedClient,
      };
    }

    const client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });

    this.clientCache.set(provider, client);

    return {
      provider,
      config,
      client,
    };
  }
}
