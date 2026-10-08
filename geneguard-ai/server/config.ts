// Server configuration from environment variables (.env is loaded if present).
// Secrets stay on the server: nothing here is ever sent to the browser.

try {
  process.loadEnvFile('.env');
} catch {
  // no .env file — that's fine, defaults and real environment variables are used
}

const effort = (process.env.AI_EFFORT ?? 'medium').trim();

export const config = {
  port: Number(process.env.PORT ?? 5173),
  host: process.env.HOST ?? '0.0.0.0',
  isProd: process.argv.includes('--prod') || process.env.NODE_ENV === 'production',
  ai: {
    enabled: Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim()),
    model: process.env.AI_MODEL?.trim() || 'claude-opus-5-5',
    effort: (['low', 'medium', 'high'].includes(effort) ? effort : 'medium') as 'low' | 'medium' | 'high',
  },
  clinvar: {
    enabled: process.env.ENABLE_CLINVAR_LOOKUP?.trim().toLowerCase() === 'true',
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
  },
  version: '1.0.0',
};
