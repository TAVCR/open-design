// Explicit ChatGPT subscription image provider. Never rewrites Codex config or
// deletes generated originals, and never routes requests to an API provider.
import { spawn } from 'node:child_process';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createCommandInvocation } from '@open-design/platform';
import { resolveCodexConfigPath } from '../codex-config-normalize.js';
import { execAgentFile } from '../runtimes/invocation.js';
import { resolveCodexImagegenEnv, resolveCodexSubscriptionStatus } from './config.js';

export interface CodexImageRenderInput {
  projectRoot: string;
  projectDir: string;
  model: string;
  prompt: string;
  aspect?: string | undefined;
  imageRefs: { abs: string }[];
  signal?: AbortSignal | undefined;
  onProgress?: ((message: string) => void) | undefined;
}

const THREAD_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const MAX_PENDING_REQUESTS = 8;
let pendingRequests = 0;
let queue: Promise<unknown> = Promise.resolve();
let terminationFailed = false;

export function codexImagegenArgs(input: CodexImageRenderInput, env: NodeJS.ProcessEnv): string[] {
  return [
    'exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write',
    '--ignore-user-config', '--ignore-rules',
    '--enable', 'image_generation',
    '-c', 'model_provider="openai"', '-c', 'forced_login_method="chatgpt"',
    '-c', 'project_doc_max_bytes=0',
    '-c', 'cli_auth_credentials_store="file"',
    '--model', env.OD_CODEX_IMAGEGEN_MODEL?.trim() || 'gpt-6-luna',
    ...input.imageRefs.flatMap(ref => ['--image', ref.abs]), '-',
  ];
}

export function parseCodexThreadId(stdout: string): string {
  let thread: string | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    let event: { type?: unknown; thread_id?: unknown };
    try { event = JSON.parse(line); } catch { continue; }
    if (!event || event.type !== 'thread.started') continue;
    if (typeof event.thread_id !== 'string' || !THREAD_ID.test(event.thread_id)) {
      throw new Error('Codex imagegen emitted an invalid thread.started thread_id');
    }
    if (thread && thread !== event.thread_id) throw new Error('Codex imagegen emitted conflicting thread IDs');
    thread = event.thread_id;
  }
  if (!thread) throw new Error('Codex imagegen did not emit a thread.started thread_id');
  return thread;
}

function imageExtension(bytes: Buffer): string | undefined {
  if (bytes.length >= 16 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && bytes.toString('ascii', 12, 16) === 'IHDR') return '.png';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return '.jpg';
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return '.webp';
  return undefined;
}

export async function readCodexGeneratedImage(codexHome: string, threadId: string) {
  if (!THREAD_ID.test(threadId)) throw new Error('Invalid Codex imagegen thread ID');
  const root = path.resolve(codexHome, 'generated_images');
  const dir = path.join(root, threadId);
  const missing = () => new Error('Codex imagegen did not write an ig_, call_ or exec- image for its thread. Check CLI image_generation support and subscription access.');
  const dirInfo = await lstat(dir).catch(() => null);
  if (!dirInfo) throw missing();
  if (!dirInfo.isDirectory() || dirInfo.isSymbolicLink()) throw new Error('Codex imagegen thread output is not a regular directory');
  // Refuse a symlinked generated_images root as well as symlinked files.
  const resolved = path.resolve(await realpath(dir));
  const expected = path.resolve(dir);
  if ((process.platform === 'win32' ? resolved.toLowerCase() !== expected.toLowerCase() : resolved !== expected)) {
    throw new Error('Codex imagegen output path is redirected');
  }
  const candidates = (await readdir(dir)).filter(name => /^(?:ig_|call_|exec-)[^/\\]+\.(?:png|jpe?g|webp)$/i.test(name));
  if (!candidates.length) throw missing();
  if (candidates.length > 1) throw new Error('Codex imagegen wrote multiple images; refusing to guess the requested result');
  const file = path.join(dir, candidates[0]!);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Codex imagegen result is not a regular file');
  if (info.size > MAX_OUTPUT_BYTES) throw new Error('Codex imagegen result exceeds the 32 MB limit');
  const bytes = await readFile(file);
  const suggestedExt = imageExtension(bytes);
  if (!suggestedExt) throw new Error('Codex imagegen output has an unsupported image signature');
  return { bytes, suggestedExt };
}

function abortError() { return new Error('Codex imagegen aborted'); }
function waitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()); };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function execute(input: CodexImageRenderInput, signal: AbortSignal) {
  if (terminationFailed) throw new Error('Codex imagegen cancellation could not stop its process tree. Restart the daemon before generating another image.');
  if (signal.aborted) throw abortError();
  const env = await resolveCodexImagegenEnv(input.projectRoot);
  const status = await resolveCodexSubscriptionStatus(input.projectRoot, env);
  if (!status.available || !status.executable) throw new Error('Codex imagegen needs an installed Codex CLI and ChatGPT login. Run codex login, then retry.');
  if (signal.aborted) throw abortError();
  const timeoutRaw = Number(env.OD_CODEX_IMAGEGEN_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw >= 1000
    ? Math.min(timeoutRaw, 10 * 60_000) : 5 * 60_000;
  const childEnv = { ...env };
  // The provider owns subscription execution, even if the daemon has API keys.
  for (const key of Object.keys(childEnv)) {
    if (['OPENAI_API_KEY', 'CODEX_API_KEY'].includes(key.toUpperCase())) delete childEnv[key];
  }
  const invocation = createCommandInvocation({ command: status.executable, args: codexImagegenArgs(input, env), env: childEnv });
  const child = spawn(invocation.command, invocation.args, {
    cwd: input.projectDir, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'],
    shell: false, windowsHide: true, detached: process.platform !== 'win32',
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  });
  const stdout = await new Promise<string>((resolve, reject) => {
    let output = ''; let capturedBytes = 0; let settled = false; let childClosed = false; let stopping: Error | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(output);
    };
    const kill = async () => {
      if (process.platform === 'win32' && child.pid) {
        // Kill only the owned live invocation tree, including npm cmd shims.
        try { await execAgentFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { timeout: 5000, windowsHide: true }); }
        catch { if (!childClosed) { terminationFailed = true; child.kill('SIGKILL'); } }
      } else if (child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      } else child.kill('SIGKILL');
    };
    const stop = (error: Error) => {
      if (settled || stopping) return;
      stopping = error;
      // Hold the serial slot until termination finishes so the next native
      // image generation cannot race the cancelled child.
      void kill().then(() => finish(error));
    };
    const abort = () => stop(abortError());
    const timer = setTimeout(() => stop(new Error(`Codex imagegen timed out after ${timeoutMs}ms`)), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      capturedBytes += chunk.length;
      if (capturedBytes > MAX_LOG_BYTES) { stop(new Error('Codex imagegen exceeded its output log limit')); return; }
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', () => { /* Never surface raw CLI logs or auth tokens. */ });
    child.stdin.on('error', () => stop(new Error('Codex imagegen could not deliver its prompt')));
    child.on('error', () => finish(new Error('Codex imagegen CLI could not be started')));
    child.on('close', (code) => {
      childClosed = true;
      if (stopping) return; // stop() owns completion after the whole tree exits.
      finish(code === 0 ? undefined : new Error(`Codex imagegen CLI failed (exit ${String(code)}). Check Codex login, subscription limits and CLI image_generation support.`));
    });
    if (signal.aborted) { abort(); return; }
    child.stdin.end([
      'Use the native image_generation tool exactly once to produce one image. Requested image model: gpt-image-2.',
      'Save the generated original through the native tool. Do not use shell rendering, APIs, or delegate to another agent.',
      input.imageRefs.length ? 'Edit the attached reference images.' : 'Generate a new image.',
      input.aspect ? `Requested aspect ratio: ${input.aspect}.` : '', input.prompt,
    ].filter(Boolean).join('\n'));
  });
  if (signal.aborted) throw abortError();
  const threadId = parseCodexThreadId(stdout);
  const result = await readCodexGeneratedImage(path.dirname(resolveCodexConfigPath(env)), threadId);
  if (signal.aborted) throw abortError();
  return { ...result, providerNote: `codex/subscription · requested gpt-image-2 (native image model not verified) · thread ${threadId} · ${result.bytes.length} bytes` };
}

export async function renderCodexImage(input: CodexImageRenderInput) {
  if (input.model !== 'codex-gpt-image-2') throw new Error('Unsupported Codex image model');
  if (input.signal?.aborted) throw abortError();
  if (pendingRequests >= MAX_PENDING_REQUESTS) throw new Error('Codex imagegen queue is full; retry after an active request finishes');
  const signal = input.signal ?? new AbortController().signal;
  pendingRequests++;
  const operation = queue.then(async () => {
    if (signal.aborted) throw abortError();
    try { input.onProgress?.('Codex subscription image generation started'); } catch { /* best effort */ }
    return execute(input, signal);
  }).finally(() => { pendingRequests--; });
  // Serialize nested CLI image requests: parallel exec has raced native image
  // generation upstream (#8110). Rejections must not poison the next request.
  queue = operation.catch(() => undefined);
  return waitWithAbort(operation, signal);
}
