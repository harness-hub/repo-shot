import { spawn } from 'child_process';
import { platform } from 'os';

export function openPath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('targetPath must be a non-empty string');
  }

  const command = platform() === 'darwin'
    ? 'open'
    : platform() === 'win32'
      ? 'cmd'
      : 'xdg-open';

  const args = platform() === 'win32'
    ? ['/c', 'start', '', targetPath]
    : [targetPath];

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
}
