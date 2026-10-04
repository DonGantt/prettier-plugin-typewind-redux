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
const V3_RECHECK_INTERVAL_MS = 2000;

let cached: TypewindMetadata | undefined;
let lastFailureAt = 0;
let cachedV3Fingerprint: { configPath: string; mtimeMs: number } | undefined;
let lastV3CheckAt = 0;

function loadV4Metadata(): TypewindMetadata | null {
  try {
    const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
    const metaPath = projectRequire.resolve('typewind-v4/dist/_metadata.json');
    const raw = fs.readFileSync(metaPath, 'utf8');
    return JSON.parse(raw) as TypewindMetadata;
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

export function loadTypewindMetadata(): TypewindMetadata | null {
  if (cached !== undefined && cachedV3Fingerprint) {
    const now = Date.now();
    if (now - lastV3CheckAt >= V3_RECHECK_INTERVAL_MS) {
      lastV3CheckAt = now;
      if (hasV3ConfigChanged()) {
        cached = undefined;
        cachedV3Fingerprint = undefined;
      }
    }
  }
  if (cached !== undefined) return cached;
  if (lastFailureAt !== 0 && Date.now() - lastFailureAt < RETRY_INTERVAL_MS) return null;

  const v4Result = loadV4Metadata();
  if (v4Result) {
    cached = v4Result;
    return cached;
  }

  const v3Result = buildV3Metadata();
  if (v3Result) {
    cached = v3Result;
    cachedV3Fingerprint = getConfigFingerprint(process.cwd()) ?? undefined;
    lastV3CheckAt = Date.now();
    return cached;
  }

  lastFailureAt = Date.now();
  return null;
}

export function resetTypewindMetadataCache(): void {
  cached = undefined;
  lastFailureAt = 0;
  cachedV3Fingerprint = undefined;
  lastV3CheckAt = 0;
}
