import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildInfo } from './build-info';

// A temp working directory with a version/ folder in it, as in an image.
function versionFolder(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'build-info-'));
  jest.spyOn(process, 'cwd').mockReturnValue(cwd);
  const dir = join(cwd, 'version');
  mkdirSync(dir);
  return dir;
}

describe('buildInfo', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads the service version and build time from the version folder', () => {
    const dir = versionFolder();
    writeFileSync(
      join(dir, 'versions.json'),
      JSON.stringify({ app: '1.4.0', users: '1.2.3' }),
    );
    writeFileSync(join(dir, 'built-at'), '2026-10-05T18:00:00Z\n');

    const info = buildInfo('users');
    expect(info).toEqual({
      service: 'users',
      version: '1.2.3',
      builtAt: '2026-10-05T18:00:00Z',
      startedAt: expect.any(String) as string,
    });
    expect(Date.parse(info.startedAt)).not.toBeNaN();
  });

  it('reports null for an unknown service and a missing build time', () => {
    const dir = versionFolder();
    writeFileSync(join(dir, 'versions.json'), JSON.stringify({ app: '1.0.0' }));

    expect(buildInfo('nope')).toMatchObject({ version: null, builtAt: null });
  });

  it('keeps the same start time for the life of the process', () => {
    expect(buildInfo('a').startedAt).toBe(buildInfo('b').startedAt);
  });
});
