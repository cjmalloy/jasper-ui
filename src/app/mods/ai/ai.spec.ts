/// <reference types="vitest/globals" />
import { aiQueryPlugin } from './ai';

describe('AI query plugin', () => {
  it('uses automatic Anthropic prompt caching', () => {
    const script = aiQueryPlugin.config?.script ?? '';
    const cacheControls = script.match(/cache_control:/g) ?? [];

    expect(cacheControls).toHaveLength(1);
    expect(script).toContain("max_tokens: config.maxTokens + (config.thinking ? config.thinkingTokens : 0),\n              cache_control: { type: 'ephemeral' },");
  });
});
