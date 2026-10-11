import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

let client = null;

export const llmEnabled = () => Boolean(env.anthropicApiKey) && !env.isTest;

/**
 * Generates text with Claude. Returns null when the API is not configured, the request fails,
 * or the model declines, so callers always fall back to the deterministic grounded template.
 */
export async function generateText({ system, prompt, maxTokens = 4000 }) {
  if (!llmEnabled()) return null;
  client ||= new Anthropic({ apiKey: env.anthropicApiKey });
  try {
    const response = await client.beta.messages.create({
      model: env.anthropicModel,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.warn('Copilot: Claude rate limited, using template.');
    else if (error instanceof Anthropic.AuthenticationError) console.warn('Copilot: invalid ANTHROPIC_API_KEY, using template.');
    else if (error instanceof Anthropic.APIError) console.warn(`Copilot: Claude API error ${error.status}, using template.`);
    else console.warn('Copilot: Claude request failed, using template.', error.message);
    return null;
  }
}
