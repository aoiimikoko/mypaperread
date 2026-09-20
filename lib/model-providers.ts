export type ProviderId = "openai" | "azure" | "deepseek" | "openrouter" | "qwen" | "siliconflow" | "volcengine" | "anthropic" | "gemini" | "custom";
export type Provider = { id: ProviderId; label: string; protocol: "openai" | "azure" | "anthropic" | "gemini"; baseUrl: string; modelHint: string };

export const providers: Provider[] = [
  { id: "openai", label: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", modelHint: "gpt-4o-mini" },
  { id: "azure", label: "Azure OpenAI", protocol: "azure", baseUrl: "", modelHint: "填写部署的模型 ID" },
  { id: "deepseek", label: "DeepSeek", protocol: "openai", baseUrl: "https://api.deepseek.com", modelHint: "deepseek-v4-flash" },
  { id: "openrouter", label: "OpenRouter", protocol: "openai", baseUrl: "https://openrouter.ai/api/v1", modelHint: "填写模型 slug" },
  { id: "qwen", label: "阿里云百炼 / 通义千问", protocol: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", modelHint: "qwen-plus" },
  { id: "siliconflow", label: "硅基流动", protocol: "openai", baseUrl: "https://api.siliconflow.cn/v1", modelHint: "填写模型 ID" },
  { id: "volcengine", label: "火山方舟", protocol: "openai", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", modelHint: "填写模型或接入点 ID" },
  { id: "anthropic", label: "Anthropic Claude", protocol: "anthropic", baseUrl: "https://api.anthropic.com", modelHint: "填写 Claude 模型 ID" },
  { id: "gemini", label: "Google Gemini", protocol: "gemini", baseUrl: "https://generativelanguage.googleapis.com", modelHint: "填写 Gemini 模型 ID" },
  { id: "custom", label: "其他兼容 OpenAI 的平台", protocol: "openai", baseUrl: "", modelHint: "填写平台模型 ID" },
];

export function providerById(value: string | undefined) {
  return providers.find(provider => provider.id === value);
}
