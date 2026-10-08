import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_MODEL, IMAGE_MODELS, canonicalMediaModelId,
  findMediaModel, findProvider, imageModelIdForPromptTemplate,
} from '../../src/media/models';
import { isMediaModelPickerReady } from '../../src/media/provider-readiness';

describe('Codex subscription image catalog', () => {
  it('defaults to an explicit subscription model without requiring media API credentials', () => {
    expect(DEFAULT_IMAGE_MODEL).toBe('codex-gpt-image-2');
    expect(IMAGE_MODELS.filter((model) => model.default).map((model) => model.id))
      .toEqual(['codex-gpt-image-2']);
    expect(findProvider('codex')).toMatchObject({ integrated: true, credentialsRequired: false });
    expect(isMediaModelPickerReady('codex-gpt-image-2', {})).toBe(true);
  });

  it('preserves saved explicit Codex, Cloud, and OpenAI API selections', () => {
    for (const [id, provider] of [
      ['codex-gpt-image-2', 'codex'], ['vela/gpt-image-2', 'vela'], ['gpt-image-2', 'openai'],
    ]) {
      expect(canonicalMediaModelId(id!)).toBe(id);
      expect(findMediaModel(id!)?.provider).toBe(provider);
    }
    expect(isMediaModelPickerReady('vela/gpt-image-2', {})).toBe(true);
    expect(isMediaModelPickerReady('gpt-image-2', {})).toBe(false);
    expect(isMediaModelPickerReady('gpt-image-2', { openai: { apiKey: 'explicit-key', baseUrl: '' } })).toBe(true);
  });

  it('uses subscription for an unqualified template family while preserving explicit routes', () => {
    expect(imageModelIdForPromptTemplate(' gpt-image-2 ')).toBe('codex-gpt-image-2');
    expect(imageModelIdForPromptTemplate('codex-gpt-image-2')).toBe('codex-gpt-image-2');
    expect(imageModelIdForPromptTemplate('vela/gpt-image-2')).toBe('vela/gpt-image-2');
  });
});
