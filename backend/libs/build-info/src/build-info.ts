import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BuildInfo {
  service: string;
  /** From version/versions.json (the repo's single source of versions); null if not found. */
  version: string | null;
  /** When this image was built (written by its Dockerfile); null outside Docker. */
  builtAt: string | null;
  startedAt: string;
}

const startedAt = new Date().toISOString();

// In an image the Dockerfile copies version/ next to the app (/app/version); in a local `nest start`
// from backend/ it's the repo's own ../version.
function versionDir(): string | null {
  const candidates = [
    process.env.VERSION_DIR,
    join(process.cwd(), 'version'),
    join(process.cwd(), '..', 'version'),
  ].filter((dir): dir is string => !!dir);
  return (
    candidates.find((dir) => existsSync(join(dir, 'versions.json'))) ?? null
  );
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** This service's version, build time and start time — what an admin needs to see what's deployed. */
export function buildInfo(service: string): BuildInfo {
  const dir = versionDir();
  let version: string | null = null;
  if (dir) {
    try {
      const versions = JSON.parse(
        readFileSync(join(dir, 'versions.json'), 'utf8'),
      ) as Record<string, unknown>;
      version =
        typeof versions[service] === 'string' ? versions[service] : null;
    } catch {
      version = null;
    }
  }
  return {
    service,
    version,
    builtAt: dir ? readOrNull(join(dir, 'built-at')) : null,
    startedAt,
  };
}
