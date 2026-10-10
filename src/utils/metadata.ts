import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { buildV3Metadata, getConfigFingerprint } from './v3-adapter';

export interface TypewindMetadata {
  variants: string[];
  classSet: string[];
  valueIndex: Record<string, Record<string, string>>;
  rootFontSize: number;
  classOrder: string[];
  cssProperties?: Record<string, string[]>;
}

const RETRY_INTERVAL_MS = 2000;
const RECHECK_INTERVAL_MS = 2000;

let cached: TypewindMetadata | undefined;
let lastFailureAt = 0;
let cachedV3Fingerprint: { configPath: string; mtimeMs: number } | undefined;
let cachedV4MtimeMs: number | undefined;
let lastRecheckAt = 0;

function resolveV4MetadataPath(): string | null {
  try {
    const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
    return projectRequire.resolve('typewind-v4/dist/_metadata.json');
  } catch {
    return null;
  }
}

// Stat before read: if the file is rewritten between the two, this stamps
// the cache with an mtime no newer than what was actually read (never
// newer), so the next check still detects the file as changed instead of
// permanently caching a stale read under a too-new mtime.
function loadV4Metadata(): { metadata: TypewindMetadata; mtimeMs: number } | null {
  const metaPath = resolveV4MetadataPath();
  if (!metaPath) return null;
  try {
    const mtimeMs = fs.statSync(metaPath).mtimeMs;
    const raw = fs.readFileSync(metaPath, 'utf8');
    return { metadata: JSON.parse(raw) as TypewindMetadata, mtimeMs };
  } catch {
    return null;
  }
}

function getV4MetadataMtime(): number | null {
  const metaPath = resolveV4MetadataPath();
  if (!metaPath) return null;
  try {
    return fs.statSync(metaPath).mtimeMs;
  } catch {
    return null;
  }
}

function hasV3ConfigChanged(): boolean {
  if (!cachedV3Fingerprint) return false;
  const current = getConfigFingerprint(process.cwd());
  if (!current) return true;
  return (
    current.configPath !== cachedV3Fingerprint.configPath ||
    current.mtimeMs !== cachedV3Fingerprint.mtimeMs
  );
}

function hasV4MetadataChanged(): boolean {
  // Unknown is treated as "changed" (forces a reload), not "unchanged" —
  // silently caching stale metadata forever is worse than one extra reload.
  if (cachedV4MtimeMs === undefined) return true;
  const current = getV4MetadataMtime();
  if (current === null) return true;
  return current !== cachedV4MtimeMs;
}

export function loadTypewindMetadata(): TypewindMetadata | null {
  if (cached !== undefined) {
    const now = Date.now();
    if (now - lastRecheckAt >= RECHECK_INTERVAL_MS) {
      lastRecheckAt = now;
      if (cachedV3Fingerprint ? hasV3ConfigChanged() : hasV4MetadataChanged()) {
        cached = undefined;
        cachedV3Fingerprint = undefined;
        cachedV4MtimeMs = undefined;
      }
    }
  }
  if (cached !== undefined) return cached;
  if (lastFailureAt !== 0 && Date.now() - lastFailureAt < RETRY_INTERVAL_MS) return null;

  const v4Result = loadV4Metadata();
  if (v4Result) {
    cached = v4Result.metadata;
    cachedV4MtimeMs = v4Result.mtimeMs;
    lastRecheckAt = Date.now();
    return cached;
  }

  const v3Result = buildV3Metadata();
  if (v3Result) {
    cached = v3Result;
    cachedV3Fingerprint = getConfigFingerprint(process.cwd()) ?? undefined;
    lastRecheckAt = Date.now();
    return cached;
  }

  lastFailureAt = Date.now();
  return null;
}

export function resetTypewindMetadataCache(): void {
  cached = undefined;
  lastFailureAt = 0;
  cachedV3Fingerprint = undefined;
  cachedV4MtimeMs = undefined;
  lastRecheckAt = 0;
}
