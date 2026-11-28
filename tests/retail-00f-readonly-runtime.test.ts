import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PiRuntimeAdapter } from '../container/agent-runner/src/runtime/pi/pi-runtime.js';
import {
  createReadonlyValidationReadTool,
  READONLY_VALIDATION_MAX_BYTES,
  READONLY_VALIDATION_TOOL_NAME,
} from '../container/agent-runner/src/runtime/pi/readonly-validation.js';

const roots: string[] = [];

function makeRoots(): { fixtures: string; evidence: string; outside: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'retail-00f-readonly-'));
  roots.push(base);
  const fixtures = path.join(base, 'fixtures');
  const evidence = path.join(base, 'evidence');
  const outside = path.join(base, 'outside');
  fs.mkdirSync(fixtures);
  fs.mkdirSync(evidence);
  fs.mkdirSync(outside);
  fs.writeFileSync(
    path.join(fixtures, 'fixture-a.json'),
    '{"sku":"TEST-001"}\n',
  );
  fs.writeFileSync(
    path.join(fixtures, 'fixture-b.json'),
    '{"sku":"TEST-002"}\n',
  );
  fs.writeFileSync(path.join(evidence, 'evidence.md'), 'synthetic evidence\n');
  return { fixtures, evidence, outside };
}

async function executeRead(
  roots: { fixtures: string; evidence: string },
  params: unknown,
) {
  const tool = createReadonlyValidationReadTool(roots);
  return (
    tool.execute as unknown as (...args: unknown[]) => Promise<{
      content: Array<{ text?: string }>;
      details?: { code?: string };
    }>
  )('test-call', params, undefined, undefined, {});
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('RETAIL-00F read-only tool execution boundary', () => {
  it('reads only fixture and evidence files and reports missing files explicitly', async () => {
    const value = makeRoots();
    const first = await executeRead(value, {
      area: 'fixtures',
      path: 'fixture-a.json',
    });
    const second = await executeRead(value, {
      area: 'evidence',
      path: 'evidence.md',
    });
    expect(first.content[0]?.text).toContain('TEST-001');
    expect(first.details?.code).toBe('READ_OK');
    expect(second.content[0]?.text).toContain('synthetic evidence');
    await expect(
      executeRead(value, { area: 'fixtures', path: 'missing.json' }),
    ).rejects.toThrow('READ_NOT_FOUND');
  });

  it('rejects traversal, absolute paths, Windows paths, and symbolic links', async () => {
    const value = makeRoots();
    fs.writeFileSync(
      path.join(value.outside, 'secret.txt'),
      'outside sentinel',
    );
    fs.symlinkSync(
      path.join(value.outside, 'secret.txt'),
      path.join(value.fixtures, 'outside-link.txt'),
    );
    fs.symlinkSync(value.outside, path.join(value.fixtures, 'outside-dir'));

    for (const requestedPath of [
      '../outside/secret.txt',
      '/etc/passwd',
      'C:\\Users\\private.txt',
      'outside-link.txt',
      'outside-dir/secret.txt',
    ]) {
      await expect(
        executeRead(value, { area: 'fixtures', path: requestedPath }),
      ).rejects.toThrow('READ_DENIED');
    }
  });

  it('rechecks the opened descriptor to reject a parent-symlink race', async () => {
    const value = makeRoots();
    const nested = path.join(value.fixtures, 'nested');
    const moved = path.join(value.fixtures, 'nested-original');
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, 'record.txt'), 'safe fixture');
    fs.writeFileSync(
      path.join(value.outside, 'record.txt'),
      'outside sentinel',
    );

    const realOpen = fs.openSync;
    let swapped = false;
    vi.spyOn(fs, 'openSync').mockImplementation(((
      file: fs.PathLike,
      flags: string | number,
      mode?: number,
    ) => {
      if (!swapped && String(file) === path.join(nested, 'record.txt')) {
        swapped = true;
        fs.renameSync(nested, moved);
        fs.symlinkSync(value.outside, nested, 'dir');
      }
      return realOpen(file, flags as number, mode);
    }) as typeof fs.openSync);

    await expect(
      executeRead(value, { area: 'fixtures', path: 'nested/record.txt' }),
    ).rejects.toThrow('READ_DENIED');
    expect(swapped).toBe(true);
  });

  it('rejects over-limit files without returning partial contents', async () => {
    const value = makeRoots();
    fs.writeFileSync(
      path.join(value.fixtures, 'large.txt'),
      Buffer.alloc(READONLY_VALIDATION_MAX_BYTES + 1, 0x61),
    );
    await expect(
      executeRead(value, { area: 'fixtures', path: 'large.txt' }),
    ).rejects.toThrow('READ_TOO_LARGE');
  });

  it('exposes only the controlled read tool through the locked Pi SDK', async () => {
    const value = makeRoots();
    const sessionRoot = path.join(os.tmpdir(), 'retail-00f-pi-session-');
    const sessionDir = fs.mkdtempSync(sessionRoot);
    roots.push(sessionDir);
    const adapter = new PiRuntimeAdapter();
    const readonly = await adapter.createSession({
      cwd: value.fixtures,
      sessionDir,
      model: 'anthropic/test-model',
      provider: {
        api: 'anthropic-messages',
        endpointKind: 'custom',
        baseUrl: 'http://127.0.0.1:1',
        apiKey: 'test-only-not-a-secret',
      },
      permissionMode: 'readonly_validation',
      readonlyValidationRoots: {
        fixtures: value.fixtures,
        evidence: value.evidence,
      },
      allowedTools: [READONLY_VALIDATION_TOOL_NAME],
      excludedTools: ['Bash', 'Write', 'Edit', 'Task', 'mcp__miniclaw__*'],
      customTools: [createReadonlyValidationReadTool(value)],
    });
    const sdkSession = (
      readonly as unknown as {
        session: {
          getActiveToolNames(): string[];
          getAllTools(): Array<{ name: string }>;
          getToolDefinition(name: string): unknown;
          dispose(): void;
        };
      }
    ).session;
    try {
      expect(sdkSession.getActiveToolNames()).toEqual([
        READONLY_VALIDATION_TOOL_NAME,
      ]);
      expect(sdkSession.getAllTools().map((tool) => tool.name)).toContain(
        READONLY_VALIDATION_TOOL_NAME,
      );
      for (const denied of [
        'bash',
        'write',
        'edit',
        'Agent',
        'get_subagent_result',
        'steer_subagent',
        'mcp__miniclaw__private',
      ]) {
        expect(sdkSession.getToolDefinition(denied)).toBeUndefined();
      }
    } finally {
      readonly.dispose();
      sdkSession.dispose();
    }
  });

  it('keeps ordinary Pi defaults available and rejects invalid restricted configuration', async () => {
    const value = makeRoots();
    const sessionDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'retail-00f-pi-standard-'),
    );
    roots.push(sessionDir);
    const adapter = new PiRuntimeAdapter();
    await expect(
      adapter.createSession({
        cwd: value.fixtures,
        sessionDir,
        permissionMode: 'readonly_validation',
        readonlyValidationRoots: value,
        allowedTools: ['Bash'],
      }),
    ).rejects.toThrow('Invalid readonly_validation runtime configuration');

    const standard = await adapter.createSession({
      cwd: value.fixtures,
      sessionDir: path.join(sessionDir, 'standard-sessions'),
      model: 'anthropic/test-model',
      provider: {
        api: 'anthropic-messages',
        endpointKind: 'custom',
        baseUrl: 'http://127.0.0.1:1',
        apiKey: 'test-only-not-a-secret',
      },
    });
    const sdkSession = (
      standard as unknown as {
        session: { getActiveToolNames(): string[]; dispose(): void };
      }
    ).session;
    try {
      expect(sdkSession.getActiveToolNames()).toEqual(
        expect.arrayContaining(['read', 'bash', 'write', 'edit']),
      );
    } finally {
      standard.dispose();
      sdkSession.dispose();
    }
  });
});
