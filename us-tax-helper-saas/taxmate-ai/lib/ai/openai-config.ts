/**
 * Shared OpenAI connection config. Set OPENAI_BASE_URL when the API key is
 * issued by a proxy/gateway (e.g. a custom OpenAI-compatible endpoint)
 * rather than https://api.openai.com directly — every OpenAI/ChatOpenAI/
 * OpenAIEmbeddings client in this app should read its baseURL from here so
 * switching gateways only means changing one env var.
 */
export function openAIClientOptions() {
  const baseURL = process.env.OPENAI_BASE_URL;
  return {
    apiKey: process.env.OPENAI_API_KEY,
    ...(baseURL ? { baseURL } : {}),
  };
}

/** Same thing, shaped for @langchain/openai (ChatOpenAI / OpenAIEmbeddings). */
export function langchainOpenAIOptions() {
  const baseURL = process.env.OPENAI_BASE_URL;
  return {
    openAIApiKey: process.env.OPENAI_API_KEY,
    ...(baseURL ? { configuration: { baseURL } } : {}),
  };
}
