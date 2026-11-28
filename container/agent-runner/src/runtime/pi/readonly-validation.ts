import fs from 'node:fs';
import path from 'node:path';
import {
  defineTool,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

export const READONLY_VALIDATION_TOOL_NAME = 'retailops_read_file';
export const READONLY_VALIDATION_MAX_BYTES = 1024 * 1024;

export type ReadonlyValidationRoots = {
  fixtures: string;
  evidence: string;
};

type ReadCode =
  | 'READ_OK'
  | 'READ_NOT_FOUND'
  | 'READ_DENIED'
  | 'READ_TOO_LARGE'
  | 'READ_ABORTED'
  | 'READ_BOUNDARY_UNAVAILABLE';

type ReadOutcome = { code: ReadCode; text?: string };

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative)
  );
}

function validateRoot(root: string): string {
  if (!path.isAbsolute(root)) {
    throw new Error('readonly_validation roots must be absolute paths');
  }
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('readonly_validation root must be a real directory');
  }
  const resolved = fs.realpathSync(root);
  if (path.resolve(root) !== resolved) {
    throw new Error('readonly_validation root must not traverse symlinks');
  }
  return resolved;
}

function readBoundedFile(
  root: string,
  relativePath: unknown,
  signal?: AbortSignal,
): ReadOutcome {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    Buffer.byteLength(relativePath, 'utf8') > 1024 ||
    relativePath.includes('\0') ||
    relativePath.includes('\\') ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath)
  ) {
    return { code: 'READ_DENIED' };
  }

  const components = relativePath.split('/');
  if (
    components.some(
      (component) =>
        component === '' || component === '.' || component === '..',
    )
  ) {
    return { code: 'READ_DENIED' };
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = validateRoot(root);
  } catch {
    return { code: 'READ_BOUNDARY_UNAVAILABLE' };
  }

  const candidate = path.resolve(canonicalRoot, ...components);
  if (!isWithin(canonicalRoot, candidate)) {
    return { code: 'READ_DENIED' };
  }

  let cursor = canonicalRoot;
  try {
    for (let index = 0; index < components.length; index += 1) {
      cursor = path.join(cursor, components[index]!);
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) return { code: 'READ_DENIED' };
      if (
        index < components.length - 1 ? !stat.isDirectory() : !stat.isFile()
      ) {
        return { code: 'READ_DENIED' };
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { code: 'READ_NOT_FOUND' };
    }
    return { code: 'READ_DENIED' };
  }

  let descriptor: number | undefined;
  try {
    const flags =
      fs.constants.O_RDONLY |
      (fs.constants.O_NOFOLLOW ?? 0) |
      (fs.constants.O_NONBLOCK ?? 0);
    descriptor = fs.openSync(candidate, flags);
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1) {
      return { code: 'READ_DENIED' };
    }

    let openedPath: string;
    try {
      openedPath = fs.realpathSync('/proc/self/fd/' + descriptor);
    } catch {
      return { code: 'READ_BOUNDARY_UNAVAILABLE' };
    }
    if (!isWithin(canonicalRoot, openedPath)) {
      return { code: 'READ_DENIED' };
    }
    if (opened.size > READONLY_VALIDATION_MAX_BYTES) {
      return { code: 'READ_TOO_LARGE' };
    }

    const chunks: Buffer[] = [];
    const buffer = Buffer.alloc(64 * 1024);
    let total = 0;
    while (true) {
      if (signal?.aborted) return { code: 'READ_ABORTED' };
      const remaining = READONLY_VALIDATION_MAX_BYTES + 1 - total;
      const count = fs.readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, remaining),
        null,
      );
      if (count === 0) break;
      total += count;
      if (total > READONLY_VALIDATION_MAX_BYTES) {
        return { code: 'READ_TOO_LARGE' };
      }
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const content = Buffer.concat(chunks);
    if (content.includes(0)) return { code: 'READ_DENIED' };
    return { code: 'READ_OK', text: content.toString('utf8') };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { code: 'READ_NOT_FOUND' };
    if (code === 'ELOOP' || code === 'EACCES' || code === 'EPERM') {
      return { code: 'READ_DENIED' };
    }
    return { code: 'READ_BOUNDARY_UNAVAILABLE' };
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        /* best effort after a completed read */
      }
    }
  }
}

const errorMessages: Record<Exclude<ReadCode, 'READ_OK'>, string> = {
  READ_NOT_FOUND:
    'READ_NOT_FOUND: the requested fixture or evidence file does not exist.',
  READ_DENIED:
    'READ_DENIED: the path is outside the allowed read-only roots or is not a regular file.',
  READ_TOO_LARGE:
    'READ_TOO_LARGE: the requested file exceeds the validation read limit.',
  READ_ABORTED: 'READ_ABORTED: the read was cancelled.',
  READ_BOUNDARY_UNAVAILABLE:
    'READ_BOUNDARY_UNAVAILABLE: the read-only boundary could not be verified.',
};

export function createReadonlyValidationReadTool(
  roots: ReadonlyValidationRoots,
): ToolDefinition {
  const fixtureRoot = validateRoot(roots.fixtures);
  const evidenceRoot = validateRoot(roots.evidence);

  return defineTool({
    name: READONLY_VALIDATION_TOOL_NAME,
    label: 'RetailOps read-only validation file',
    description:
      'Read one UTF-8 fixture or evidence file beneath the explicitly mounted read-only validation roots.',
    parameters: Type.Object({
      area: Type.Union([Type.Literal('fixtures'), Type.Literal('evidence')]),
      path: Type.String({ minLength: 1, maxLength: 1024 }),
    }),
    execute: async (_toolCallId, params, signal) => {
      const input = params as { area?: unknown; path?: unknown };
      if (input.area !== 'fixtures' && input.area !== 'evidence') {
        throw new Error(errorMessages.READ_DENIED);
      }
      const result = readBoundedFile(
        input.area === 'fixtures' ? fixtureRoot : evidenceRoot,
        input.path,
        signal,
      );
      if (result.code === 'READ_OK') {
        return {
          content: [{ type: 'text' as const, text: result.text ?? '' }],
          details: { code: result.code },
        };
      }
      // Pi SDK 0.84.2's AgentToolResult does not contain `isError`; the agent
      // core derives the tool-result error flag from a thrown exception.
      throw new Error(errorMessages[result.code]);
    },
  });
}
