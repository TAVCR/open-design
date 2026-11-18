import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock('../../src/media/codex-imagegen.js', () => ({ renderCodexImage: mocks.render }));
vi.mock('../../src/media/config.js', () => ({ resolveModelAlias: async (_root: string, model: string) => model, resolveProviderConfig: async () => ({ apiKey: '', baseUrl: '' }) }));
import { generateMedia } from '../../src/media/index.js';
let root: string;
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'od-codex-dispatch-')); mocks.render.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await rm(root, { recursive: true, force: true }); });
const request = () => ({ projectRoot: root, projectsRoot: path.join(root, 'projects'), projectId: 'sample', surface: 'image' as const, model: 'codex-gpt-image-2', prompt: 'Draw a cat', output: 'result.png' });
describe('explicit Codex dispatcher', () => {
  it('writes provider bytes and passes resolved reference paths and cancellation', async () => {
    const dir = path.join(root, 'projects', 'sample'); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'ref.png'), png);
    const controller = new AbortController();
    mocks.render.mockResolvedValue({ bytes: png, suggestedExt: '.png', providerNote: 'codex/subscription · requested gpt-image-2 (native image model not verified)' });
    const result = await generateMedia({ ...request(), image: 'ref.png', signal: controller.signal });
    expect(result.providerId).toBe('codex'); expect(result.usedStubFallback).toBe(false);
    expect(await readFile(path.join(dir, 'result.png'))).toEqual(png);
    expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ projectDir: dir, imageRefs: [expect.objectContaining({ abs: path.join(dir, 'ref.png') })], signal: controller.signal }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never substitutes a stub or remote API when Codex fails', async () => {
    vi.stubEnv('OD_MEDIA_ALLOW_STUBS', '1'); mocks.render.mockRejectedValue(new Error('subscription quota exceeded'));
    await expect(generateMedia(request())).rejects.toThrow('subscription quota exceeded');
    expect(fetch).not.toHaveBeenCalled();
    await expect(readFile(path.join(root, 'projects', 'sample', 'result.png'))).rejects.toThrow();
  });
  it('never turns an OpenAI API request into a Codex subscription request', async () => {
    vi.stubEnv('OD_MEDIA_ALLOW_STUBS', '0');
    await expect(generateMedia({ ...request(), model: 'gpt-image-2' })).rejects.toThrow(/no OpenAI credential/);
    expect(mocks.render).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the imported project root for references and generated originals', async () => {
    const external=path.join(root,'linked'); await mkdir(external);
    await writeFile(path.join(external,'ref.png'),png);
    mocks.render.mockResolvedValue({bytes:png,suggestedExt:'.png',providerNote:'native'});
    await generateMedia({...request(), projectMetadata:{baseDir:external}, images:['ref.png']});
    expect(await readFile(path.join(external,'result.png'))).toEqual(png);
    expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({projectDir:external,imageRefs:[expect.objectContaining({abs:path.join(external,'ref.png')})]}));
    await expect(readFile(path.join(root,'projects','sample','result.png'))).rejects.toThrow();
  });
  it('rejects references through a project junction to an external directory before provider dispatch', async () => {
    const dir=path.join(root,'projects','sample'), outside=path.join(root,'private');
    await mkdir(dir,{recursive:true}); await mkdir(outside); await writeFile(path.join(outside,'ref.png'),png);
    await symlink(outside,path.join(dir,'alias'),process.platform==='win32'?'junction':'dir');
    await expect(generateMedia({...request(),images:['alias/ref.png']})).rejects.toThrow(/outside|escape/i);
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it('rejects output symlink escape before consuming the native provider', async (context) => {
    const dir=path.join(root,'projects','sample'), outside=path.join(root,'private.png');
    await mkdir(dir,{recursive:true}); await writeFile(outside,png);
    try { await symlink(outside,path.join(dir,'result.png'),'file'); }
    catch(error) { if((error as NodeJS.ErrnoException).code==='EPERM') {context.skip();return;} throw error; }
    await expect(generateMedia(request())).rejects.toThrow(/outside|escape/i);
    expect(mocks.render).not.toHaveBeenCalled();
    expect(await readFile(outside)).toEqual(png);
  });

});
