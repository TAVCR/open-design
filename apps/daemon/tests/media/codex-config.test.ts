import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ executable: 'codex.cmd' as string | null, configuredEnv: {} as Record<string, string> }));
vi.mock('../../src/runtimes/executables.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/runtimes/executables.js')>(),
  resolveAgentExecutable: () => mocks.executable,
}));
vi.mock('../../src/app-config.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/app-config.js')>(),
  readAppConfig: async () => ({ agentCliEnv: { codex: mocks.configuredEnv } }),
}));
import { readMaskedConfig, resolveCodexImagegenEnv, resolveCodexSubscriptionStatus, resolveProviderConfig, seedProviderIfMissing, writeConfig } from '../../src/media/config.js';
let home: string;
beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'od-codex-config-'));
  vi.stubEnv('CODEX_HOME', home); vi.stubEnv('OD_MEDIA_CONFIG_DIR', path.join(home, 'media'));
  vi.stubEnv('OD_SANDBOX_MODE', ''); mocks.executable = 'codex.cmd'; mocks.configuredEnv = {};
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(home, { recursive: true, force: true }); });
async function auth(data: unknown, dir = home) { await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, 'auth.json'), JSON.stringify(data)); }

describe('Codex subscription readiness', () => {
  it('requires a ChatGPT token and an installed executable, not an API key or auth_mode alone', async () => {
    await auth({ OPENAI_API_KEY: 'paid-key', auth_mode: 'apikey' });
    expect((await resolveCodexSubscriptionStatus(home)).available).toBe(false);
    await auth({ auth_mode: 'chatgpt' });
    expect((await resolveCodexSubscriptionStatus(home)).available).toBe(false);
    await auth({ auth_mode: 'chatgpt', tokens: { access_token: 'subscription-secret' } });
    expect((await resolveCodexSubscriptionStatus(home)).available).toBe(true);
    mocks.executable = null;
    expect((await resolveCodexSubscriptionStatus(home)).available).toBe(false);
  });
  it('respects the runtime CODEX_HOME preference and never returns subscription secrets', async () => {
    const configured = path.join(home, 'configured'); mocks.configuredEnv = { CODEX_HOME: configured };
    await auth({ tokens: { access_token: 'subscription-secret' } }, configured);
    expect((await resolveCodexImagegenEnv(home)).CODEX_HOME).toBe(configured);
    const masked = await readMaskedConfig(home);
    expect(masked.providers.codex).toEqual({ configured: true, source: 'codex-subscription', apiKeyTail: '', baseUrl: '' });
    expect(JSON.stringify(masked)).not.toContain('subscription-secret');
    expect(await resolveProviderConfig(home, 'codex')).toEqual({ apiKey: '', baseUrl: '' });
  });
  it('rejects sandbox host access and malformed auth files', async () => {
    await writeFile(path.join(home, 'auth.json'), 'bad json');
    expect((await resolveCodexSubscriptionStatus(home)).available).toBe(false);
    await auth({ auth_mode: 'chatgpt', tokens: { access_token: 'subscription-secret' } });
    vi.stubEnv('OD_SANDBOX_MODE', '1');
    expect((await resolveCodexSubscriptionStatus(home)).available).toBe(false);
  });
  it('does not persist or seed API credentials for the subscription provider', async () => {
    expect(await seedProviderIfMissing(home, 'codex', { apiKey: 'paid-key' })).toBe(false);
    await writeConfig(home, { providers: { codex: { apiKey: 'paid-key', baseUrl: 'https://api.example.test' } } });
    const stored = await readFile(path.join(home, 'media', 'media-config.json'), 'utf8');
    expect(stored).not.toContain('paid-key'); expect(JSON.parse(stored).providers).toEqual({});
  });
});
