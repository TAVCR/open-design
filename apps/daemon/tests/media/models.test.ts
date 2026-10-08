import { describe, expect, it } from 'vitest';

import {
  IMAGE_MODELS,
  MEDIA_PROVIDERS,
  canonicalMediaModelId,
  findMediaModel,
} from '../../src/media/models.js';

describe('image model defaults', () => {
  it('uses Codex subscription as the only default image route', () => {
    expect(IMAGE_MODELS.filter((model) => model.default).map((model) => model.id)).toEqual([
      'codex-gpt-image-2',
    ]);
    expect(MEDIA_PROVIDERS.find((provider) => provider.id === 'codex')).toMatchObject({
      integrated: true, credentialsRequired: false, settingsVisible: false,
    });
    expect(findMediaModel('codex-gpt-image-2')?.provider).toBe('codex');
    expect(findMediaModel('vela/gpt-image-2')?.provider).toBe('vela');
  });

  it('preserves the saved Codex image model id without a Cloud fallback', () => {
    expect(canonicalMediaModelId('codex-gpt-image-2')).toBe('codex-gpt-image-2');
  });

  it('preserves explicit OpenAI BYOK model selection', () => {
    expect(canonicalMediaModelId('gpt-image-2')).toBe('gpt-image-2');
    expect(findMediaModel('gpt-image-2')?.provider).toBe('openai');
  });
});
