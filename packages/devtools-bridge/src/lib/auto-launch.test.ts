import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findBinary, launchDebugger } from './auto-launch.js';
import * as child_process from 'node:child_process';

vi.mock('node:child_process');

describe('findBinary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns path from PATH when binary exists', () => {
    vi.mocked(child_process.execFileSync).mockReturnValue(
      Buffer.from('/usr/local/bin/wolfcola-devtools\n'),
    );
    const result = findBinary();
    expect(result).toBe('/usr/local/bin/wolfcola-devtools');
  });

  it('returns null when binary is not found', () => {
    vi.mocked(child_process.execFileSync).mockImplementation(() => {
      throw new Error('not found');
    });
    const result = findBinary();
    expect(result).toBeNull();
  });
});

describe('launchDebugger', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses execFile-style spawn (not shell) with detached + ignore', () => {
    const mockProcess = { unref: vi.fn(), on: vi.fn() } as unknown as ReturnType<
      typeof child_process.spawn
    >;
    vi.mocked(child_process.spawn).mockReturnValue(mockProcess);

    launchDebugger('/usr/local/bin/wolfcola-devtools');

    expect(child_process.spawn).toHaveBeenCalledWith(
      '/usr/local/bin/wolfcola-devtools',
      [],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    );
    expect(mockProcess.unref).toHaveBeenCalled();
  });

  it('passes --port flag when port specified', () => {
    const mockProcess = { unref: vi.fn(), on: vi.fn() } as unknown as ReturnType<
      typeof child_process.spawn
    >;
    vi.mocked(child_process.spawn).mockReturnValue(mockProcess);

    launchDebugger('/usr/local/bin/wolfcola-devtools', 8888);

    expect(child_process.spawn).toHaveBeenCalledWith(
      '/usr/local/bin/wolfcola-devtools',
      ['--port', '8888'],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    );
  });
});
