import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildReadonlyValidationWorkspace,
  resolveHostPermissionMode,
} from '../src/readonly-validation-policy.js';
import {
  buildContainerArgs,
  buildVolumeMounts,
} from '../src/container-runner.js';
import { DATA_DIR } from '../src/config.js';
import { randomUUID } from 'node:crypto';

const roots: string[] = [];

function makeDataRoot(): { data: string; task: string } {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'retail-00f-policy-'));
  roots.push(data);
  const task = 'task-readonly-001';
  const taskRoot = path.join(data, 'retailops', '00f-validation', task);
  fs.mkdirSync(path.join(taskRoot, 'fixtures'), { recursive: true });
  fs.mkdirSync(path.join(taskRoot, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(taskRoot, 'fixtures', 'fixture-a.json'), '{}');
  fs.writeFileSync(path.join(taskRoot, 'fixtures', 'fixture-b.json'), '{}');
  fs.writeFileSync(path.join(taskRoot, 'evidence', 'evidence.md'), 'evidence');
  return { data, task };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('RETAIL-00F isolated host mount policy', () => {
  it('uses isolated writable state and only read-only business roots', () => {
    const value = makeDataRoot();
    const plan = buildReadonlyValidationWorkspace(value.data, value.task);
    const byDestination = new Map(
      plan.mounts.map((mount) => [mount.containerPath, mount]),
    );

    expect(byDestination.get('/retailops/fixtures')?.readonly).toBe(true);
    expect(byDestination.get('/retailops/evidence')?.readonly).toBe(true);
    expect(byDestination.get('/workspace/group')?.readonly).toBe(false);
    expect(byDestination.get('/home/node/.claude')?.readonly).toBe(false);
    expect(byDestination.get('/workspace/ipc')?.readonly).toBe(false);
    expect(byDestination.get('/workspace/extra')?.readonly).toBe(false);
    expect(plan.mounts).toHaveLength(6);
    expect(
      plan.mounts.some((mount) =>
        ['/workspace/project', '/home/node', '/workspace/plugins'].includes(
          mount.containerPath,
        ),
      ),
    ).toBe(false);
  });

  it('rejects traversal ids and symlinked evidence roots', () => {
    const value = makeDataRoot();
    expect(() =>
      buildReadonlyValidationWorkspace(value.data, '../not-safe'),
    ).toThrow('safe taskRunId');

    const taskRoot = path.join(
      value.data,
      'retailops',
      '00f-validation',
      value.task,
    );
    const evidence = path.join(taskRoot, 'evidence');
    const moved = path.join(taskRoot, 'evidence-original');
    fs.renameSync(evidence, moved);
    fs.symlinkSync(moved, evidence, 'dir');
    expect(() =>
      buildReadonlyValidationWorkspace(value.data, value.task),
    ).toThrow('real directory');
  });

  it('fails closed for unknown host modes and defaults normal agents to standard', () => {
    expect(resolveHostPermissionMode({} as NodeJS.ProcessEnv)).toBe('standard');
    expect(
      resolveHostPermissionMode({
        MINICLAW_HOST_PERMISSION_MODE: 'readonly_validation',
      } as NodeJS.ProcessEnv),
    ).toBe('readonly_validation');
    expect(() =>
      resolveHostPermissionMode({
        MINICLAW_HOST_PERMISSION_MODE: 'typo',
      } as NodeJS.ProcessEnv),
    ).toThrow('Unsupported MINICLAW_HOST_PERMISSION_MODE');
  });
  it('builds the real Host Runner mount list without home, project, or plugin mounts', () => {
    const previousLiveSource = process.env.MINICLAW_CONTAINER_LIVE_SOURCE;
    const task = 'host-policy-' + randomUUID();
    const taskRoot = path.join(DATA_DIR, 'retailops', '00f-validation', task);
    fs.mkdirSync(path.join(taskRoot, 'fixtures'), { recursive: true });
    fs.mkdirSync(path.join(taskRoot, 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(taskRoot, 'fixtures', 'fixture-a.json'), '{}');
    fs.writeFileSync(path.join(taskRoot, 'fixtures', 'fixture-b.json'), '{}');
    fs.writeFileSync(
      path.join(taskRoot, 'evidence', 'evidence.md'),
      'evidence',
    );
    process.env.MINICLAW_CONTAINER_LIVE_SOURCE = 'true';
    try {
      const mounts = buildVolumeMounts(
        {
          folder: 'retail-00f-validation',
          name: 'RETAIL-00F validation',
          is_home: false,
          containerConfig: null,
        } as never,
        false,
        false,
        undefined,
        undefined,
        task,
        undefined,
        undefined,
        undefined,
        undefined,
        'readonly_validation',
      );
      const byDestination = new Map(
        mounts.map((mount) => [mount.containerPath, mount]),
      );
      expect(byDestination.get('/retailops/fixtures')?.readonly).toBe(true);
      expect(byDestination.get('/retailops/evidence')?.readonly).toBe(true);
      expect(byDestination.get('/workspace/group')?.readonly).toBe(false);
      expect(byDestination.get('/home/node/.claude')?.readonly).toBe(false);
      expect(byDestination.get('/workspace/ipc')?.readonly).toBe(false);
      expect(byDestination.get('/workspace/extra')?.readonly).toBe(false);
      expect(byDestination.get('/app/src')?.readonly).toBe(true);
      expect(byDestination.get('/app/prompts')?.readonly).toBe(true);
      expect(byDestination.has('/workspace/project')).toBe(false);
      expect(byDestination.has('/workspace/plugins')).toBe(false);
      expect(
        mounts.every(
          (mount) =>
            mount.hostPath.startsWith(path.join(taskRoot, 'instance')) ||
            mount.containerPath === '/app/src' ||
            mount.containerPath === '/app/prompts' ||
            mount.containerPath === '/retailops/fixtures' ||
            mount.containerPath === '/retailops/evidence',
        ),
      ).toBe(true);

      const hostIdentity = { mode: 'direct' as const, uid: 1000, gid: 1000 };
      const restrictedArgs = buildContainerArgs(
        mounts,
        'retail-00f-test',
        'UTC',
        hostIdentity,
        'readonly_validation',
      );
      const standardArgs = buildContainerArgs(
        [],
        'retail-00f-standard-test',
        'UTC',
        hostIdentity,
        'standard',
      );
      expect(restrictedArgs).toContain(
        'MINICLAW_RUNTIME_PERMISSION_MODE=readonly_validation',
      );
      expect(standardArgs).not.toContain(
        'MINICLAW_RUNTIME_PERMISSION_MODE=readonly_validation',
      );
    } finally {
      if (previousLiveSource === undefined) {
        delete process.env.MINICLAW_CONTAINER_LIVE_SOURCE;
      } else {
        process.env.MINICLAW_CONTAINER_LIVE_SOURCE = previousLiveSource;
      }
      fs.rmSync(taskRoot, { recursive: true, force: true });
    }
  });
});
