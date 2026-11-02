import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMediaGenerationContract } from '../../src/prompts/media-contract.js';
import { composeSystemPrompt } from '../../src/prompts/system.js';

describe('Codex subscription media prompt policy', () => {
  it('uses the daemon dispatcher for enabled runs and keeps an explicit model choice', () => {
    const prompt = renderMediaGenerationContract({ mode: 'enabled' });
    expect(prompt).toContain('codex-gpt-image-2');
    expect(prompt).toContain('ChatGPT subscription');
    expect(prompt).toContain('Never silently substitute');
  });

  it('keeps disabled execution closed for the subscription route', () => {
    const prompt = renderMediaGenerationContract({ mode: 'disabled' });
    expect(prompt).toContain('disabled for this run');
    expect(prompt).not.toContain('--model codex-gpt-image-2');
  });

  it('defaults AMR image execution to subscription while preserving explicit routes', () => {
    expect(composeSystemPrompt({ agentId: 'amr', metadata: { kind: 'image' } }))
      .toContain('Image model: `codex-gpt-image-2`');
    for (const imageModel of ['gpt-image-2', 'vela/gpt-image-2']) {
      expect(composeSystemPrompt({ agentId: 'amr', metadata: { kind: 'image', imageModel } }))
        .toContain(`Image model: \`${imageModel}\``);
    }
  });

  it('carries the subscription boundary in the lazily loaded OD Next media skill', () => {
    const skill = readFileSync(new URL('../../../../skills/od-next-media-inputs/SKILL.md', import.meta.url), 'utf8');
    expect(skill).toContain('codex-gpt-image-2');
    expect(skill).toContain('Never silently substitute');
    expect(skill).toContain('current route, stage, frozen plan');
  });
});
