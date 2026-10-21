import { describe, expect, it } from 'vitest';

import {
  buildHomeMediaComposer,
  metadataForHomeMediaComposer,
} from '../src/components/home-hero/media-surfaces';

describe('Home image composer metadata', () => {
  it('persists the default Codex subscription model into project metadata', () => {
    const composer = buildHomeMediaComposer('image', []);

    expect(metadataForHomeMediaComposer('image', composer.inputs, [])).toEqual({
      kind: 'image',
      imageModel: 'codex-gpt-image-2',
    });
  });

  it('preserves an explicitly selected OpenAI BYOK model', () => {
    const composer = buildHomeMediaComposer('image', [], { model: 'gpt-image-2' });

    expect(metadataForHomeMediaComposer('image', composer.inputs, [])).toEqual({
      kind: 'image',
      imageModel: 'gpt-image-2',
    });
  });

  it('preserves explicit subscription and Cloud selections', () => {
    for (const model of ['codex-gpt-image-2', 'vela/gpt-image-2']) {
      const composer = buildHomeMediaComposer('image', [], { model });
      expect(metadataForHomeMediaComposer('image', composer.inputs, []))
        .toMatchObject({ imageModel: model });
    }
  });

  it('keeps an unavailable saved image model visible and never substitutes a provider', () => {
    const composer = buildHomeMediaComposer('image', [], { model: 'saved-custom-image-model' });
    expect(metadataForHomeMediaComposer('image', composer.inputs, []))
      .toMatchObject({ imageModel: 'saved-custom-image-model' });
    expect(composer.fields.find((field) => field.name === 'model')?.options)
      .toContain('saved-custom-image-model');
  });
});
