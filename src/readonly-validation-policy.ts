import fs from 'node:fs';
import path from 'node:path';

export type RuntimePermissionMode = 'standard' | 'readonly_validation';

export type ReadonlyValidationMount = {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
};

export type ReadonlyValidationWorkspace = {
  rootDir: string;
  fixturesDir: string;
  evidenceDir: string;
  instanceDir: string;
  envDir: string;
  logsDir: string;
  mounts: ReadonlyValidationMount[];
};

export type ReadonlyValidationRuntimeDirs = {
  sessionDir: string;
  ipcDir: string;
};

export function resolveHostPermissionMode(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimePermissionMode {
  const value = environment.MINICLAW_HOST_PERMISSION_MODE;
  if (value === undefined) return 'standard';
  if (value === 'standard' || value === 'readonly_validation') return value;
  throw new Error(
    'Unsupported MINICLAW_HOST_PERMISSION_MODE: ' + (value || '(empty)'),
  );
}

export function assertReadonlyValidationTaskRunId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error(
      'readonly_validation requires a safe taskRunId containing only letters, digits, underscore, or hyphen',
    );
  }
  return value;
}

function ensureRealDirectory(directory: string, create: boolean): string {
  if (create) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      'readonly_validation path must be a real directory: ' + directory,
    );
  }
  const real = fs.realpathSync(directory);
  if (path.resolve(directory) !== real) {
    throw new Error(
      'readonly_validation path must not traverse symlinks: ' + directory,
    );
  }
  try {
    fs.chmodSync(real, 0o700);
  } catch {
    /* Docker/WSL may preserve a mode that the host cannot change. */
  }
  return real;
}

export function buildReadonlyValidationWorkspace(
  dataDir: string,
  taskRunIdValue: unknown,
): ReadonlyValidationWorkspace {
  const taskRunId = assertReadonlyValidationTaskRunId(taskRunIdValue);
  const dataRoot = ensureRealDirectory(path.resolve(dataDir), false);
  const rootDir = ensureRealDirectory(
    path.join(dataRoot, 'retailops', '00f-validation'),
    false,
  );
  const fixturesDir = ensureRealDirectory(
    path.join(rootDir, 'fixtures'),
    false,
  );
  const evidenceDir = ensureRealDirectory(
    path.join(rootDir, 'evidence'),
    false,
  );
  const instancesDir = ensureRealDirectory(
    path.join(rootDir, 'instances'),
    true,
  );
  const instanceDir = path.join(instancesDir, taskRunId);
  // Task run IDs are unique. Refuse to reuse stale writable state or follow a
  // pre-existing symlink when a scheduler retries or a caller replays a run.
  fs.mkdirSync(instanceDir, { mode: 0o700 });
  ensureRealDirectory(instanceDir, false);
  const envDir = ensureRealDirectory(path.join(instanceDir, 'env'), true);
  const workspaceDir = ensureRealDirectory(
    path.join(instanceDir, 'workspace'),
    true,
  );
  const extraDir = ensureRealDirectory(path.join(instanceDir, 'extra'), true);
  const logsDir = ensureRealDirectory(path.join(instanceDir, 'logs'), true);

  return {
    rootDir,
    fixturesDir,
    evidenceDir,
    instanceDir,
    envDir,
    logsDir,
    mounts: [
      {
        hostPath: workspaceDir,
        containerPath: '/workspace/group',
        readonly: false,
      },
      {
        hostPath: extraDir,
        containerPath: '/workspace/extra',
        readonly: false,
      },
      {
        hostPath: fixturesDir,
        containerPath: '/retailops/fixtures',
        readonly: true,
      },
      {
        hostPath: evidenceDir,
        containerPath: '/retailops/evidence',
        readonly: true,
      },
    ],
  };
}

function ensureNestedRuntimeDirectory(
  root: string,
  segments: string[],
): string {
  let current = ensureRealDirectory(path.resolve(root), false);
  for (const segment of segments) {
    if (segment !== '.claude' && !/^[A-Za-z0-9_-]{1,128}$/.test(segment)) {
      throw new Error(
        'readonly_validation runtime path contains an unsafe segment',
      );
    }
    current = ensureRealDirectory(path.join(current, segment), true);
  }
  return current;
}

/**
 * Use the same per-task Session and IPC paths the product host reads and
 * cleans. These paths stay separate from the mounted business fixtures.
 */
export function buildReadonlyValidationRuntimeDirs(
  dataDir: string,
  groupFolder: string,
  sessionAgentIdValue: unknown,
  taskRunIdValue: unknown,
): ReadonlyValidationRuntimeDirs {
  const taskRunId = assertReadonlyValidationTaskRunId(taskRunIdValue);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(groupFolder)) {
    throw new Error('readonly_validation requires a safe workspace folder');
  }
  const sessionAgentId = assertReadonlyValidationTaskRunId(sessionAgentIdValue);
  const dataRoot = ensureRealDirectory(path.resolve(dataDir), false);
  const sessionDir = ensureNestedRuntimeDirectory(dataRoot, [
    'sessions',
    groupFolder,
    'agents',
    sessionAgentId,
    '.claude',
  ]);
  const ipcDir = ensureNestedRuntimeDirectory(dataRoot, [
    'ipc',
    groupFolder,
    'tasks-run',
    taskRunId,
  ]);
  return { sessionDir, ipcDir };
}

export function resolveReadonlyValidationNetworkName(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const network = environment.MINICLAW_READONLY_VALIDATION_NETWORK;
  if (!network || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(network)) {
    throw new Error(
      'readonly_validation requires MINICLAW_READONLY_VALIDATION_NETWORK to name a dedicated internal Docker network',
    );
  }
  return network;
}

/** Remove only this task's disposable writable validation state. */
export function cleanupReadonlyValidationInstance(
  dataDir: string,
  taskRunIdValue: unknown,
): void {
  const taskRunId = assertReadonlyValidationTaskRunId(taskRunIdValue);
  const dataRoot = ensureRealDirectory(path.resolve(dataDir), false);
  const validationRootPath = path.join(dataRoot, 'retailops', '00f-validation');
  if (!fs.existsSync(validationRootPath)) return;
  const rootDir = ensureRealDirectory(validationRootPath, false);
  const instancesPath = path.join(rootDir, 'instances');
  if (!fs.existsSync(instancesPath)) return;
  const instancesDir = ensureRealDirectory(instancesPath, false);
  const instanceDir = path.join(instancesDir, taskRunId);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(instanceDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      'readonly_validation cleanup target must be a real directory',
    );
  }
  if (fs.realpathSync(instanceDir) !== instanceDir) {
    throw new Error(
      'readonly_validation cleanup target must not traverse symlinks',
    );
  }
  fs.rmSync(instanceDir, { recursive: true, force: false });
}
