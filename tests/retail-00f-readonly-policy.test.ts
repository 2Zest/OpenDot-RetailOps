import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildReadonlyValidationWorkspace,
  buildReadonlyValidationRuntimeDirs,
  cleanupReadonlyValidationInstance,
  resolveReadonlyValidationNetworkName,
  resolveHostPermissionMode,
} from '../src/readonly-validation-policy.js';
import {
  buildContainerArgs,
  buildVolumeMounts,
  runHostAgent,
} from '../src/container-runner.js';
import { DATA_DIR } from '../src/config.js';
import { randomUUID } from 'node:crypto';

const roots: string[] = [];

function makeDataRoot(): { data: string; task: string } {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'retail-00f-policy-'));
  roots.push(data);
  const task = 'task-readonly-001';
  const validationRoot = path.join(data, 'retailops', '00f-validation');
  fs.mkdirSync(path.join(validationRoot, 'fixtures'), { recursive: true });
  fs.mkdirSync(path.join(validationRoot, 'evidence'), { recursive: true });
  fs.writeFileSync(
    path.join(validationRoot, 'fixtures', 'fixture-a.json'),
    '{}',
  );
  fs.writeFileSync(
    path.join(validationRoot, 'fixtures', 'fixture-b.json'),
    '{}',
  );
  fs.writeFileSync(
    path.join(validationRoot, 'evidence', 'evidence.md'),
    'evidence',
  );
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
    expect(byDestination.get('/workspace/extra')?.readonly).toBe(false);
    expect(plan.instanceDir).toContain(path.join('instances', value.task));
    expect(plan.mounts).toHaveLength(4);
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

    const validationRoot = path.join(value.data, 'retailops', '00f-validation');
    const evidence = path.join(validationRoot, 'evidence');
    const moved = path.join(validationRoot, 'evidence-original');
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

  it('uses product Session and IPC namespaces and safely destroys only one instance', () => {
    const value = makeDataRoot();
    const runtime = buildReadonlyValidationRuntimeDirs(
      value.data,
      'retail-00f-validation',
      'task-session-001',
      value.task,
    );
    expect(runtime.sessionDir).toBe(
      path.join(
        value.data,
        'sessions',
        'retail-00f-validation',
        'agents',
        'task-session-001',
        '.claude',
      ),
    );
    expect(runtime.ipcDir).toBe(
      path.join(
        value.data,
        'ipc',
        'retail-00f-validation',
        'tasks-run',
        value.task,
      ),
    );

    const plan = buildReadonlyValidationWorkspace(value.data, value.task);
    const fixturePath = path.join(plan.fixturesDir, 'fixture-a.json');
    cleanupReadonlyValidationInstance(value.data, value.task);
    expect(fs.existsSync(plan.instanceDir)).toBe(false);
    expect(fs.existsSync(fixturePath)).toBe(true);
    expect(() =>
      buildReadonlyValidationWorkspace(value.data, value.task),
    ).not.toThrow();
  });

  it('requires an explicitly named validation network', () => {
    expect(
      resolveReadonlyValidationNetworkName({
        MINICLAW_READONLY_VALIDATION_NETWORK: 'retail00f-r1-net',
      } as NodeJS.ProcessEnv),
    ).toBe('retail00f-r1-net');
    expect(() =>
      resolveReadonlyValidationNetworkName({} as NodeJS.ProcessEnv),
    ).toThrow('requires MINICLAW_READONLY_VALIDATION_NETWORK');
    expect(() =>
      resolveReadonlyValidationNetworkName({
        MINICLAW_READONLY_VALIDATION_NETWORK: 'bad/network',
      } as NodeJS.ProcessEnv),
    ).toThrow('requires MINICLAW_READONLY_VALIDATION_NETWORK');
  });

  it('blocks Host Runner execution before it touches a workspace in restricted mode', async () => {
    const previousMode = process.env.MINICLAW_HOST_PERMISSION_MODE;
    process.env.MINICLAW_HOST_PERMISSION_MODE = 'readonly_validation';
    let started = false;
    try {
      const result = await runHostAgent({} as never, {} as never, () => {
        started = true;
      });
      expect(result.status).toBe('error');
      expect(result.error).toContain('does not permit Host Execution');
      expect(started).toBe(false);
    } finally {
      if (previousMode === undefined) {
        delete process.env.MINICLAW_HOST_PERMISSION_MODE;
      } else {
        process.env.MINICLAW_HOST_PERMISSION_MODE = previousMode;
      }
    }
  });
  it('builds the real Host Runner mount list without home, project, or plugin mounts', () => {
    const previousLiveSource = process.env.MINICLAW_CONTAINER_LIVE_SOURCE;
    const previousNetwork = process.env.MINICLAW_READONLY_VALIDATION_NETWORK;
    const groupFolder = 'retail00f-policy-' + randomUUID();
    const task = 'host-policy-' + randomUUID();
    const validationRoot = path.join(DATA_DIR, 'retailops', '00f-validation');
    fs.mkdirSync(path.join(validationRoot, 'fixtures'), { recursive: true });
    fs.mkdirSync(path.join(validationRoot, 'evidence'), { recursive: true });
    process.env.MINICLAW_CONTAINER_LIVE_SOURCE = 'true';
    process.env.MINICLAW_READONLY_VALIDATION_NETWORK = 'retail00f-r1-unit';
    try {
      const mounts = buildVolumeMounts(
        {
          folder: groupFolder,
          name: 'RETAIL-00F validation',
          is_home: false,
          containerConfig: null,
        } as never,
        false,
        false,
        'task-session-' + task,
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
            mount.hostPath.startsWith(
              path.join(validationRoot, 'instances', task),
            ) ||
            mount.hostPath.startsWith(
              path.join(DATA_DIR, 'sessions', groupFolder),
            ) ||
            mount.hostPath.startsWith(
              path.join(DATA_DIR, 'ipc', groupFolder),
            ) ||
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
      expect(restrictedArgs).toContain('--network');
      expect(restrictedArgs).toContain('retail00f-r1-unit');
      expect(standardArgs).not.toContain(
        'MINICLAW_RUNTIME_PERMISSION_MODE=readonly_validation',
      );
      expect(standardArgs).not.toContain('--network');
    } finally {
      if (previousLiveSource === undefined) {
        delete process.env.MINICLAW_CONTAINER_LIVE_SOURCE;
      } else {
        process.env.MINICLAW_CONTAINER_LIVE_SOURCE = previousLiveSource;
      }
      if (previousNetwork === undefined) {
        delete process.env.MINICLAW_READONLY_VALIDATION_NETWORK;
      } else {
        process.env.MINICLAW_READONLY_VALIDATION_NETWORK = previousNetwork;
      }
      cleanupReadonlyValidationInstance(DATA_DIR, task);
      fs.rmSync(path.join(DATA_DIR, 'sessions', groupFolder), {
        recursive: true,
        force: true,
      });
      fs.rmSync(path.join(DATA_DIR, 'ipc', groupFolder), {
        recursive: true,
        force: true,
      });
    }
  });
});
