import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  openSync,
  closeSync,
  fsyncSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { emptyState, apply, SCHEMA, fail } from './core.mjs';

export const digest = content =>
  createHash('sha256').update(content).digest('hex');

function validateState(state) {
  if (
    state === null ||
    typeof state !== 'object' ||
    Array.isArray(state) ||
    state.schema !== SCHEMA ||
    !Number.isSafeInteger(state.generation) ||
    state.generation < 0 ||
    !Array.isArray(state.artifacts)
  ) {
    fail(
      'Unsupported or damaged workspace; restore a backup',
      500,
    );
  }

  return state;
}

function removeIfPresent(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function store(path) {
  if (typeof path !== 'string' || !path.trim()) {
    throw new TypeError('Workspace path must be a non-empty string');
  }

  const file = resolve(path);
  const directory = dirname(file);
  const lockFile = `${file}.lock`;

  function read() {
    let content;

    // Only a missing workspace means an empty workspace.
    try {
      content = readFileSync(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState();
      throw error;
    }

    let state;

    try {
      state = JSON.parse(content);
    } catch (cause) {
      throw Object.assign(
        new Error(
          'Workspace contains invalid JSON; restore a backup',
          { cause },
        ),
        { status: 500 },
      );
    }

    return validateState(state);
  }

  function mutate(input) {
    mkdirSync(directory, {
      recursive: true,
      mode: 0o700,
    });

    let lockHandle;

    try {
      lockHandle = openSync(lockFile, 'wx', 0o600);
    } catch (error) {
      if (error.code === 'EEXIST') {
        fail(
          'Workspace is busy. Retry. After a crashed writer, ' +
          'remove its .lock file only once all PlanRelay processes stop.',
          409,
        );
      }

      throw error;
    }

    let tempFile;
    let tempHandle;
    let directoryHandle;
    let ownsTemp = false;
    let committed = false;
    let result;

    const errors = [];

    // A cleanup failure must never prevent the remaining cleanup steps.
    function attemptCleanup(action) {
      try {
        action();
      } catch (error) {
        errors.push(error);
      }
    }

    try {
      // Generate the name inside the protected block so any failure
      // still releases the lock.
      tempFile = `${file}.${randomUUID()}.tmp`;

      result = apply(read(), input, {
        id: randomUUID(),
        revision:
          typeof input?.content === 'string'
            ? digest(input.content)
            : undefined,
        now: new Date().toISOString(),
      });

      if (!result.unchanged) {
        validateState(result.state);

        // Serialize before creating the temporary file.
        const content = `${JSON.stringify(result.state, null, 2)}\n`;

        tempHandle = openSync(tempFile, 'wx', 0o600);
        ownsTemp = true;

        // Write and flush through the same writable descriptor.
        writeFileSync(tempHandle, content, { encoding: 'utf8' });
        fsyncSync(tempHandle);

        const handle = tempHandle;
        tempHandle = undefined;
        closeSync(handle);

        // Open before rename: a failure here leaves the old file intact.
        // Windows does not support this directory-fsync approach.
        if (process.platform !== 'win32') {
          directoryHandle = openSync(directory, 'r');
        }

        // Both paths share the same directory/filesystem.
        renameSync(tempFile, file);
        committed = true;
        ownsTemp = false;

        // Persist the directory entry where supported.
        if (directoryHandle !== undefined) {
          fsyncSync(directoryHandle);
        }
      }
    } catch (error) {
      errors.push(error);
    } finally {
      if (tempHandle !== undefined) {
        attemptCleanup(() => closeSync(tempHandle));
      }

      // Never delete a path whose exclusive creation failed.
      if (ownsTemp) {
        attemptCleanup(() => removeIfPresent(tempFile));
      }

      if (directoryHandle !== undefined) {
        attemptCleanup(() => closeSync(directoryHandle));
      }

      attemptCleanup(() => closeSync(lockHandle));
      attemptCleanup(() => removeIfPresent(lockFile));
    }

    if (errors.length > 0) {
      const primary = errors[0];

      const error =
        errors.length === 1
          ? primary
          : new AggregateError(
              errors,
              primary.message,
              { cause: primary },
            );

      error.status = primary.status ?? 500;

      // If true, rename succeeded. Reload before retrying:
      // the mutation may already be visible despite this error.
      error.committed = committed;

      throw error;
    }

    return result;
  }

  return { file, read, mutate };
}
