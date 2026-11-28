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
  mounts: ReadonlyValidationMount[];
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
  const rootDir = path.join(dataRoot, 'retailops', '00f-validation', taskRunId);
  const fixturesDir = ensureRealDirectory(
    path.join(rootDir, 'fixtures'),
    false,
  );
  const evidenceDir = ensureRealDirectory(
    path.join(rootDir, 'evidence'),
    false,
  );
  const instanceDir = ensureRealDirectory(path.join(rootDir, 'instance'), true);
  const envDir = ensureRealDirectory(path.join(instanceDir, 'env'), true);
  const workspaceDir = ensureRealDirectory(
    path.join(instanceDir, 'workspace'),
    true,
  );
  const sessionDir = ensureRealDirectory(
    path.join(instanceDir, 'session'),
    true,
  );
  const ipcDir = ensureRealDirectory(path.join(instanceDir, 'ipc'), true);
  const extraDir = ensureRealDirectory(path.join(instanceDir, 'extra'), true);

  return {
    rootDir,
    fixturesDir,
    evidenceDir,
    instanceDir,
    envDir,
    mounts: [
      {
        hostPath: workspaceDir,
        containerPath: '/workspace/group',
        readonly: false,
      },
      {
        hostPath: sessionDir,
        containerPath: '/home/node/.claude',
        readonly: false,
      },
      {
        hostPath: ipcDir,
        containerPath: '/workspace/ipc',
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
