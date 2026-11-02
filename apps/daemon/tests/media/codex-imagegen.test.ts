import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), kill: vi.fn(), env: {} as NodeJS.ProcessEnv }));
vi.mock('node:child_process', async (importOriginal) => ({ ...await importOriginal<typeof import('node:child_process')>(), spawn: mocks.spawn }));
vi.mock('../../src/runtimes/invocation.js', () => ({ execAgentFile: mocks.kill }));
vi.mock('../../src/media/config.js', () => ({
  resolveCodexImagegenEnv: async () => mocks.env,
  resolveCodexSubscriptionStatus: async () => ({ available: true, executable: 'codex.cmd' }),
}));
import { codexImagegenArgs, parseCodexThreadId, readCodexGeneratedImage, renderCodexImage } from '../../src/media/codex-imagegen.js';

const thread = '019aaa00-1234-7000-8000-0123456789ab';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const jpeg = Buffer.from('ffd8ffe000104a4649460001', 'hex');
let home: string;
function fakeChild() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: vi.fn(() => true), pid: undefined as number | undefined,
  });
}
async function image(name: string, bytes = png, id = thread) {
  const dir = path.join(home, 'generated_images', id);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return file;
}
beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'od-codex-imagegen-'));
  mocks.env = { CODEX_HOME: home };
  mocks.spawn.mockReset();
  mocks.kill.mockReset();
});
afterEach(async () => { vi.useRealTimers(); await rm(home, { recursive: true, force: true }); });

describe('Codex imagegen output ownership', () => {
  it('accepts split JSONL and refuses missing, conflicting or traversal thread IDs', () => {
    expect(parseCodexThreadId(`noise\n${JSON.stringify({ type: 'thread.started', thread_id: thread })}\n`)).toBe(thread);
    expect(() => parseCodexThreadId('{}')).toThrow(/thread.started/);
    expect(() => parseCodexThreadId('{"type":"thread.started","thread_id":"../other"}')).toThrow(/thread/);
    expect(() => parseCodexThreadId(`${JSON.stringify({ type: 'thread.started', thread_id: thread })}\n{"type":"thread.started","thread_id":"019aaa00-1234-7000-8000-0123456789ac"}`)).toThrow(/thread/);
  });
  it('imports only its own ig_ or call_ file, sniffs bytes and keeps originals', async () => {
    const original = await image('call_result.png', jpeg);
    await image('ig_other.png', png, '019aaa00-1234-7000-8000-0123456789ac');
    await image('reference.png');
    const result = await readCodexGeneratedImage(home, thread);
    expect(result.bytes).toEqual(jpeg);
    expect(result.suggestedExt).toBe('.jpg');
    expect(await readFile(original)).toEqual(jpeg);
  });
  it('refuses fake image extensions, missing output and ambiguous multiple results', async () => {
    await expect(readCodexGeneratedImage(home, thread)).rejects.toThrow(/did not write/);
    await image('ig_result.png', Buffer.from('not an image'));
    await expect(readCodexGeneratedImage(home, thread)).rejects.toThrow(/signature/);
    await image('call_second.webp');
    await expect(readCodexGeneratedImage(home, thread)).rejects.toThrow(/multiple/);
  });
  it('accepts the exec- filename emitted by Codex CLI 0.159.2', async () => {
    await image('exec-64923644-97a5-48ef-a545-85c0d526470a.png');
    expect((await readCodexGeneratedImage(home, thread)).bytes).toEqual(png);
  });
  it('accepts WebP signatures and refuses redirected thread directories', async () => {
    const webp = Buffer.from('52494646200000005745425056503858', 'hex');
    await image('ig_result.png', webp);
    expect((await readCodexGeneratedImage(home, thread)).suggestedExt).toBe('.webp');
    const other = '019aaa00-1234-7000-8000-0123456789ac';
    await symlink(path.join(home, 'generated_images', thread), path.join(home, 'generated_images', other), 'junction');
    await expect(readCodexGeneratedImage(home, other)).rejects.toThrow(/directory/);
  });
});

describe('Codex CLI execution', () => {
  const input = () => ({ projectRoot: home, projectDir: home, model: 'codex-gpt-image-2', prompt: 'Draw %SECRET% and $()', aspect: '9:16', imageRefs: [{ abs: path.join(home, 'reference.png') }] });
  it('uses native image_generation, ChatGPT only and reference paths without prompt argv', () => {
    const args = codexImagegenArgs(input(), mocks.env);
    expect(args).toContain('image_generation');
    expect(args).toContain('forced_login_method="chatgpt"');
    expect(args).toContain('model_provider="openai"');
    expect(args).toContain(path.join(home, 'reference.png'));
    expect(args.at(-1)).toBe('-');
    expect(args).not.toContain(input().prompt);
    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--ignore-rules');
    expect(args).toContain('project_doc_max_bytes=0');
    expect(args).not.toContain('danger-full-access');
  });
  it('handles JSONL chunk boundaries, returns truthful model note, and avoids config writes', async () => {
    const child = fakeChild(); mocks.spawn.mockReturnValue(child);
    await image('ig_result.png');
    const config = path.join(home, 'config.toml'); await writeFile(config, 'service_tier = "old"');
    const run = renderCodexImage(input());
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce());
    const event = JSON.stringify({ type: 'thread.started', thread_id: thread });
    child.stdout.write(event.slice(0, 15)); child.stdout.write(event.slice(15) + '\n');
    child.emit('close', 0);
    const result = await run;
    expect(result.bytes).toEqual(png);
    expect(result.providerNote).toMatch(/requested gpt-image-2.*not verified/);
    expect(await readFile(config, 'utf8')).toBe('service_tier = "old"');
    expect(child.stdin.read()?.toString()).toContain(input().prompt);
    const options = mocks.spawn.mock.calls[0]![2];
    expect(options.windowsHide).toBe(true);
    expect(options.shell).toBe(false);
    if (process.platform === 'win32') expect(options.windowsVerbatimArguments).toBe(true);
  });
  it('serializes CLI requests and never executes a cancelled queued request', async () => {
    const first = fakeChild(); mocks.spawn.mockReturnValue(first);
    const controller = new AbortController();
    const run = renderCodexImage(input());
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce());
    const queued = renderCodexImage({ ...input(), signal: controller.signal });
    const queuedError = expect(queued).rejects.toThrow(/abort/i);
    controller.abort(); await queuedError;
    await image('ig_result.png');
    first.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: thread }) + '\n');
    first.emit('close', 0); await run;
    expect(mocks.spawn).toHaveBeenCalledOnce();
  });
  it('bounds pending requests and rejects unsupported model IDs before spawning', async () => {
    await expect(renderCodexImage({ ...input(), model: 'gpt-image-2' })).rejects.toThrow(/Unsupported/);
    const child = fakeChild(); mocks.spawn.mockReturnValue(child);
    const first = renderCodexImage(input());
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce());
    const controllers = Array.from({ length: 7 }, () => new AbortController());
    const queued = controllers.map(controller => renderCodexImage({ ...input(), signal: controller.signal }));
    const rejections = queued.map(promise => expect(promise).rejects.toThrow(/abort/i));
    await expect(renderCodexImage(input())).rejects.toThrow(/queue is full/);
    controllers.forEach(controller => controller.abort()); await Promise.all(rejections);
    await image('ig_result.png');
    child.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: thread }) + '\n');
    child.emit('close', 0); await first;
    expect(mocks.spawn).toHaveBeenCalledOnce();
  });
  it('kills a timed out process and rejects without importing output', async () => {
    vi.useFakeTimers(); mocks.env.OD_CODEX_IMAGEGEN_TIMEOUT_MS = '1000';
    const child = fakeChild(); mocks.spawn.mockReturnValue(child);
    const run = renderCodexImage(input());
    const rejection = expect(run).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejection; expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  });
  it('removes paid API keys from the child environment', async () => {
    mocks.env.OPENAI_API_KEY = 'paid-secret'; mocks.env.CODEX_API_KEY = 'paid-secret';
    const child = fakeChild(); mocks.spawn.mockReturnValue(child);
    const run = renderCodexImage(input()); const rejected = expect(run).rejects.toThrow(/exit 1/);
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce());
    expect(mocks.spawn.mock.calls[0]![2].env).not.toHaveProperty('OPENAI_API_KEY');
    expect(mocks.spawn.mock.calls[0]![2].env).not.toHaveProperty('CODEX_API_KEY');
    child.emit('close', 1); await rejected;
  });
  it.skipIf(process.platform !== 'win32')('waits for Windows tree termination before starting the next queued request', async () => {
    const first = fakeChild(); first.pid = 123;
    const second = fakeChild(); mocks.spawn.mockReturnValueOnce(first).mockReturnValueOnce(second);
    let terminated!: () => void;
    mocks.kill.mockReturnValue(new Promise<void>(resolve => { terminated = resolve; }));
    const controller = new AbortController();
    const initial = renderCodexImage({ ...input(), signal: controller.signal });
    const cancelled = expect(initial).rejects.toThrow(/abort/i);
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledOnce());
    const next = renderCodexImage(input()); const nextError = expect(next).rejects.toThrow(/exit 1/);
    controller.abort(); await cancelled;
    expect(mocks.kill).toHaveBeenCalledWith('taskkill.exe', ['/PID', '123', '/T', '/F'], { timeout: 5000, windowsHide: true });
    expect(mocks.spawn).toHaveBeenCalledOnce();
    terminated();
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(2));
    second.emit('close', 1); await nextError;
  });
});
