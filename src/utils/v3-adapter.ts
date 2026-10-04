import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import type { TypewindMetadata } from './metadata';

const CONFIG_CANDIDATES = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs'];
const MAX_UPWARD_SEARCH_DEPTH = 10;

export function findTailwindConfig(startDir: string): string | null {
  let dir = startDir;
  for (let depth = 0; depth < MAX_UPWARD_SEARCH_DEPTH; depth++) {
    for (const candidate of CONFIG_CANDIDATES) {
      const configPath = path.join(dir, candidate);
      if (fs.existsSync(configPath)) return configPath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function getConfigFingerprint(cwd: string): { configPath: string; mtimeMs: number } | null {
  const configPath = findTailwindConfig(cwd);
  if (!configPath) return null;
  try {
    return { configPath, mtimeMs: fs.statSync(configPath).mtimeMs };
  } catch {
    return null;
  }
}

const fmtToTypewind = (s: string): string => s.replace(/-/g, '_').replace(/^@/, '$');

const ARBITRARY_FAMILIES = [
  'bg', 'text', 'border', 'border-t', 'border-r', 'border-b', 'border-l',
  'border-x', 'border-y', 'border-s', 'border-e',
  'ring', 'ring-offset', 'fill', 'stroke', 'outline', 'caret', 'accent',
  'decoration', 'from', 'via', 'to', 'divide', 'placeholder',
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  'w', 'h', 'size', 'min-w', 'max-w', 'min-h', 'max-h', 'basis',
  'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end',
  'font', 'tracking', 'leading', 'indent',
  'text-shadow',
  'translate-x', 'translate-y', 'translate-z',
  'rotate', 'rotate-x', 'rotate-y', 'rotate-z',
  'scale', 'scale-x', 'scale-y', 'scale-z',
  'skew-x', 'skew-y',
  'opacity', 'shadow', 'shadow-color', 'drop-shadow',
  'blur', 'brightness', 'contrast', 'grayscale', 'hue-rotate',
  'invert', 'saturate', 'sepia',
  'backdrop-blur', 'backdrop-brightness', 'backdrop-contrast',
  'backdrop-grayscale', 'backdrop-hue-rotate', 'backdrop-invert',
  'backdrop-opacity', 'backdrop-saturate', 'backdrop-sepia',
  'rounded', 'rounded-t', 'rounded-r', 'rounded-b', 'rounded-l',
  'rounded-tl', 'rounded-tr', 'rounded-br', 'rounded-bl',
  'rounded-ss', 'rounded-se', 'rounded-ee', 'rounded-es',
  'z', 'order', 'grow', 'shrink', 'flex', 'columns', 'aspect',
  'grid-cols', 'grid-rows',
  'col-start', 'col-end', 'col-span', 'row-start', 'row-end', 'row-span',
  'scroll-m', 'scroll-mx', 'scroll-my', 'scroll-mt', 'scroll-mr',
  'scroll-mb', 'scroll-ml', 'scroll-ms', 'scroll-me',
  'scroll-p', 'scroll-px', 'scroll-py', 'scroll-pt', 'scroll-pr',
  'scroll-pb', 'scroll-pl', 'scroll-ps', 'scroll-pe',
  'animate', 'duration', 'delay', 'ease',
  'outline-offset',
  'perspective',
  'border-spacing', 'border-spacing-x', 'border-spacing-y',
  'divide-x', 'divide-y',
].map(fmtToTypewind);

function isValidIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

function extractCssProperties(css: string): string[] {
  const props = new Set<string>();
  const declRegex = /([a-zA-Z-]+)\s*:\s*[^;{}]+;?/g;
  let match: RegExpExecArray | null;
  while ((match = declRegex.exec(css))) {
    const prop = match[1];
    if (prop.startsWith('-')) continue;
    props.add(prop);
  }
  return [...props];
}

function normalizeToPx(value: string, rootFontSize: number): number | null {
  const remMatch = value.trim().match(/^(-?[0-9.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * rootFontSize;

  const pxMatch = value.trim().match(/^(-?[0-9.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);

  return null;
}

interface TailwindV3Context {
  getClassList(): string[];
  getClassOrder(classList: string[]): [string, bigint | null][];
}

export function buildV3Metadata(cwd: string = process.cwd()): TypewindMetadata | null {
  const configPath = findTailwindConfig(cwd);
  if (!configPath) return null;

  try {
    const configDir = path.dirname(configPath);
    const projectRequire = createRequire(path.join(configDir, 'package.json'));
    const requireFromProject = (id: string) => projectRequire(projectRequire.resolve(id, { paths: [configDir] }));

    const resolveConfig = requireFromProject('tailwindcss/resolveConfig');
    const { createContext } = requireFromProject('tailwindcss/lib/lib/setupContextUtils');
    const { generateRules } = requireFromProject('tailwindcss/lib/lib/generateRules');
    const postcss = requireFromProject('postcss');

    const cacheKeysBefore = new Set(Object.keys(projectRequire.cache));
    delete projectRequire.cache[projectRequire.resolve(configPath)];
    const userConfig = projectRequire(configPath);
    for (const key of Object.keys(projectRequire.cache)) {
      if (!cacheKeysBefore.has(key) && !key.includes(`${path.sep}node_modules${path.sep}`)) {
        delete projectRequire.cache[key];
      }
    }
    const ctx: TailwindV3Context = createContext(resolveConfig(userConfig.default ?? userConfig));

    const rawClassList = ctx.getClassList().filter((name) => !/[.[/()]/.test(name));
    const propToKebab = new Map<string, string>();
    for (const kebab of rawClassList) {
      const prop = fmtToTypewind(kebab);
      if (!isValidIdentifier(prop)) continue;
      if (!propToKebab.has(prop)) propToKebab.set(prop, kebab);
    }

    const order = ctx.getClassOrder([...propToKebab.values()]);
    const kebabToOrder = new Map<string, bigint>();
    for (const [kebab, pos] of order) {
      if (pos !== null) kebabToOrder.set(kebab, pos);
    }

    const classOrder = [...propToKebab.entries()]
      .filter(([, kebab]) => kebabToOrder.has(kebab))
      .sort((a, b) => {
        const orderA = kebabToOrder.get(a[1])!;
        const orderB = kebabToOrder.get(b[1])!;
        return orderA < orderB ? -1 : orderA > orderB ? 1 : 0;
      })
      .map(([prop]) => prop);

    const rootFontSize = 16;
    const cssProperties: Record<string, string[]> = {};
    const valueIndex: Record<string, Record<string, string>> = {};

    const sortedFamilies = [...ARBITRARY_FAMILIES].sort((a, b) => b.length - a.length);

    for (const [prop, kebab] of propToKebab) {
      let root: {
        toString(): string;
        append(node: unknown): void;
        walkDecls(cb: (decl: { prop: string; value: string }) => void): void;
      };
      try {
        const rules = generateRules(new Set([kebab]), ctx);
        if (rules.length === 0) continue;
        root = postcss.root();
        root.append(rules[0][1].clone());
      } catch {
        continue;
      }

      const properties = extractCssProperties(root.toString());
      if (properties.length > 0) cssProperties[prop] = properties;

      let px: number | null = null;
      root.walkDecls((decl) => {
        if (px !== null) return;
        px = normalizeToPx(decl.value, rootFontSize);
      });
      if (px === null) continue;

      const stripped = prop.startsWith('_') ? prop.slice(1) : prop;
      const family = sortedFamilies.find((fam) => stripped === fam || stripped.startsWith(fam + '_'));
      if (!family) continue;

      const key = String(px);
      valueIndex[family] ??= {};
      const existing = valueIndex[family][key];
      if (existing === undefined || (existing.startsWith('_') && !prop.startsWith('_'))) {
        valueIndex[family][key] = prop;
      }
    }

    return {
      variants: [],
      classSet: [...propToKebab.keys()],
      valueIndex,
      rootFontSize,
      classOrder,
      cssProperties,
    };
  } catch {
    return null;
  }
}
