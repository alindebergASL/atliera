import { closeSync, constants, openSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/** Linux local-filesystem lock on the root inode, held by the caller's open description.
 * flock's fd mode shares that description through fd 3; exiting the helper does not
 * release it. Closing our fd (including SIGKILL/process death) releases the lock.
 * No PID, timeout, unlink or stale-owner guess can evict a live writer.
 * Requires util-linux /usr/bin/flock. Fail closed if unavailable. All writers must
 * use this protocol; stop directory-lock-era writers before upgrading/rolling back.
 */
export function acquireWorkStoreLock(root: string): number {
  const fd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const result = spawnSync('/usr/bin/flock', ['--exclusive', '--nonblock', '3'], {
      stdio: ['ignore', 'pipe', 'pipe', fd], timeout: 5000,
    });
    if (result.error || result.signal || result.status !== 0) {
      if (!result.error && !result.signal && result.status === 1) throw Error('Work store busy. Local work kept; retry Save.');
      throw Error('Private work locking unavailable. Local work kept; check Linux flock support.');
    }
    return fd;
  } catch (error) { closeSync(fd); throw error; }
}
