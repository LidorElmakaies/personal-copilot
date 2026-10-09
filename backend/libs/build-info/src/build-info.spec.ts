import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildInfo } from './build-info';

describe('buildInfo', () => {
  const original = process.env.VERSION_DIR;
  afterEach(() => {
    process.env.VERSION_DIR = original;
  });

  it('reads the service version and build time from the version folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'version-'));
    writeFileSync(
      join(dir, 'versions.json'),
      JSON.stringify({ app: '1.4.0', users: '1.2.3' }),
    );
    writeFileSync(join(dir, 'built-at'), '2026-10-05T18:00:00Z\n');
    process.env.VERSION_DIR = dir;

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
    const dir = mkdtempSync(join(tmpdir(), 'version-'));
    writeFileSync(join(dir, 'versions.json'), JSON.stringify({ app: '1.0.0' }));
    process.env.VERSION_DIR = dir;

    expect(buildInfo('nope')).toMatchObject({ version: null, builtAt: null });
  });

  it('keeps the same start time for the life of the process', () => {
    expect(buildInfo('a').startedAt).toBe(buildInfo('b').startedAt);
  });
});
