// src/index.ts
import { parsers as babelParsers } from "prettier/plugins/babel";
import { parsers as typescriptParsers } from "prettier/plugins/typescript";

// src/utils/metadata.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { createRequire as createRequire2 } from "module";

// src/utils/v3-adapter.ts
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";
var CONFIG_CANDIDATES = ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs"];
var MAX_UPWARD_SEARCH_DEPTH = 10;
function findTailwindConfig(startDir) {
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
function getConfigFingerprint(cwd) {
  const configPath = findTailwindConfig(cwd);
  if (!configPath) return null;
  try {
    return { configPath, mtimeMs: fs.statSync(configPath).mtimeMs };
  } catch {
    return null;
  }
}
var fmtToTypewind = (s) => s.replace(/-/g, "_").replace(/^@/, "$");
var ARBITRARY_FAMILIES = [
  "bg",
  "text",
  "border",
  "border-t",
  "border-r",
  "border-b",
  "border-l",
  "border-x",
  "border-y",
  "border-s",
  "border-e",
  "ring",
  "ring-offset",
  "fill",
  "stroke",
  "outline",
  "caret",
  "accent",
  "decoration",
  "from",
  "via",
  "to",
  "divide",
  "placeholder",
  "p",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "ps",
  "pe",
  "m",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "ms",
  "me",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  "w",
  "h",
  "size",
  "min-w",
  "max-w",
  "min-h",
  "max-h",
  "basis",
  "inset",
  "inset-x",
  "inset-y",
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  "font",
  "tracking",
  "leading",
  "indent",
  "text-shadow",
  "translate-x",
  "translate-y",
  "translate-z",
  "rotate",
  "rotate-x",
  "rotate-y",
  "rotate-z",
  "scale",
  "scale-x",
  "scale-y",
  "scale-z",
  "skew-x",
  "skew-y",
  "opacity",
  "shadow",
  "shadow-color",
  "drop-shadow",
  "blur",
  "brightness",
  "contrast",
  "grayscale",
  "hue-rotate",
  "invert",
  "saturate",
  "sepia",
  "backdrop-blur",
  "backdrop-brightness",
  "backdrop-contrast",
  "backdrop-grayscale",
  "backdrop-hue-rotate",
  "backdrop-invert",
  "backdrop-opacity",
  "backdrop-saturate",
  "backdrop-sepia",
  "rounded",
  "rounded-t",
  "rounded-r",
  "rounded-b",
  "rounded-l",
  "rounded-tl",
  "rounded-tr",
  "rounded-br",
  "rounded-bl",
  "rounded-ss",
  "rounded-se",
  "rounded-ee",
  "rounded-es",
  "z",
  "order",
  "grow",
  "shrink",
  "flex",
  "columns",
  "aspect",
  "grid-cols",
  "grid-rows",
  "col-start",
  "col-end",
  "col-span",
  "row-start",
  "row-end",
  "row-span",
  "scroll-m",
  "scroll-mx",
  "scroll-my",
  "scroll-mt",
  "scroll-mr",
  "scroll-mb",
  "scroll-ml",
  "scroll-ms",
  "scroll-me",
  "scroll-p",
  "scroll-px",
  "scroll-py",
  "scroll-pt",
  "scroll-pr",
  "scroll-pb",
  "scroll-pl",
  "scroll-ps",
  "scroll-pe",
  "animate",
  "duration",
  "delay",
  "ease",
  "outline-offset",
  "perspective",
  "border-spacing",
  "border-spacing-x",
  "border-spacing-y",
  "divide-x",
  "divide-y"
].map(fmtToTypewind);
function isValidIdentifier(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}
function extractCssProperties(css) {
  const props = /* @__PURE__ */ new Set();
  const declRegex = /([a-zA-Z-]+)\s*:\s*[^;{}]+;?/g;
  let match;
  while (match = declRegex.exec(css)) {
    const prop = match[1];
    if (prop.startsWith("-")) continue;
    props.add(prop);
  }
  return [...props];
}
function normalizeToPx(value, rootFontSize) {
  const remMatch = value.trim().match(/^(-?[0-9.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * rootFontSize;
  const pxMatch = value.trim().match(/^(-?[0-9.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);
  return null;
}
function buildV3Metadata(cwd = process.cwd()) {
  const configPath = findTailwindConfig(cwd);
  if (!configPath) return null;
  try {
    const configDir = path.dirname(configPath);
    const projectRequire = createRequire(path.join(configDir, "package.json"));
    const requireFromProject = (id) => projectRequire(projectRequire.resolve(id, { paths: [configDir] }));
    const resolveConfig = requireFromProject("tailwindcss/resolveConfig");
    const { createContext } = requireFromProject("tailwindcss/lib/lib/setupContextUtils");
    const { generateRules } = requireFromProject("tailwindcss/lib/lib/generateRules");
    const postcss = requireFromProject("postcss");
    const cacheKeysBefore = new Set(Object.keys(projectRequire.cache));
    delete projectRequire.cache[projectRequire.resolve(configPath)];
    const userConfig = projectRequire(configPath);
    for (const key of Object.keys(projectRequire.cache)) {
      if (!cacheKeysBefore.has(key) && !key.includes(`${path.sep}node_modules${path.sep}`)) {
        delete projectRequire.cache[key];
      }
    }
    const ctx = createContext(resolveConfig(userConfig.default ?? userConfig));
    const rawClassList = ctx.getClassList().filter((name) => !/[.[/()]/.test(name));
    const propToKebab = /* @__PURE__ */ new Map();
    for (const kebab of rawClassList) {
      const prop = fmtToTypewind(kebab);
      if (!isValidIdentifier(prop)) continue;
      if (!propToKebab.has(prop)) propToKebab.set(prop, kebab);
    }
    const order = ctx.getClassOrder([...propToKebab.values()]);
    const kebabToOrder = /* @__PURE__ */ new Map();
    for (const [kebab, pos] of order) {
      if (pos !== null) kebabToOrder.set(kebab, pos);
    }
    const classOrder = [...propToKebab.entries()].filter(([, kebab]) => kebabToOrder.has(kebab)).sort((a, b) => {
      const orderA = kebabToOrder.get(a[1]);
      const orderB = kebabToOrder.get(b[1]);
      return orderA < orderB ? -1 : orderA > orderB ? 1 : 0;
    }).map(([prop]) => prop);
    const rootFontSize = 16;
    const cssProperties = {};
    const valueIndex = {};
    const sortedFamilies = [...ARBITRARY_FAMILIES].sort((a, b) => b.length - a.length);
    for (const [prop, kebab] of propToKebab) {
      let root;
      try {
        const rules = generateRules(/* @__PURE__ */ new Set([kebab]), ctx);
        if (rules.length === 0) continue;
        root = postcss.root();
        root.append(rules[0][1].clone());
      } catch {
        continue;
      }
      const properties = extractCssProperties(root.toString());
      if (properties.length > 0) cssProperties[prop] = properties;
      let px = null;
      root.walkDecls((decl) => {
        if (px !== null) return;
        px = normalizeToPx(decl.value, rootFontSize);
      });
      if (px === null) continue;
      const stripped = prop.startsWith("_") ? prop.slice(1) : prop;
      const family = sortedFamilies.find((fam) => stripped === fam || stripped.startsWith(fam + "_"));
      if (!family) continue;
      const key = String(px);
      valueIndex[family] ??= {};
      const existing = valueIndex[family][key];
      if (existing === void 0 || existing.startsWith("_") && !prop.startsWith("_")) {
        valueIndex[family][key] = prop;
      }
    }
    return {
      variants: [],
      classSet: [...propToKebab.keys()],
      valueIndex,
      rootFontSize,
      classOrder,
      cssProperties
    };
  } catch {
    return null;
  }
}

// src/utils/metadata.ts
var RETRY_INTERVAL_MS = 2e3;
var RECHECK_INTERVAL_MS = 2e3;
var cached;
var lastFailureAt = 0;
var cachedV3Fingerprint;
var cachedV4MtimeMs;
var lastRecheckAt = 0;
function resolveV4MetadataPath() {
  try {
    const projectRequire = createRequire2(path2.join(process.cwd(), "package.json"));
    return projectRequire.resolve("typewind-v4/dist/_metadata.json");
  } catch {
    return null;
  }
}
function loadV4Metadata() {
  const metaPath = resolveV4MetadataPath();
  if (!metaPath) return null;
  try {
    const mtimeMs = fs2.statSync(metaPath).mtimeMs;
    const raw = fs2.readFileSync(metaPath, "utf8");
    return { metadata: JSON.parse(raw), mtimeMs };
  } catch {
    return null;
  }
}
function getV4MetadataMtime() {
  const metaPath = resolveV4MetadataPath();
  if (!metaPath) return null;
  try {
    return fs2.statSync(metaPath).mtimeMs;
  } catch {
    return null;
  }
}
function hasV3ConfigChanged() {
  if (!cachedV3Fingerprint) return false;
  const current = getConfigFingerprint(process.cwd());
  if (!current) return true;
  return current.configPath !== cachedV3Fingerprint.configPath || current.mtimeMs !== cachedV3Fingerprint.mtimeMs;
}
function hasV4MetadataChanged() {
  if (cachedV4MtimeMs === void 0) return true;
  const current = getV4MetadataMtime();
  if (current === null) return true;
  return current !== cachedV4MtimeMs;
}
function loadTypewindMetadata() {
  if (cached !== void 0) {
    const now = Date.now();
    if (now - lastRecheckAt >= RECHECK_INTERVAL_MS) {
      lastRecheckAt = now;
      if (cachedV3Fingerprint ? hasV3ConfigChanged() : hasV4MetadataChanged()) {
        cached = void 0;
        cachedV3Fingerprint = void 0;
        cachedV4MtimeMs = void 0;
      }
    }
  }
  if (cached !== void 0) return cached;
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
    cachedV3Fingerprint = getConfigFingerprint(process.cwd()) ?? void 0;
    lastRecheckAt = Date.now();
    return cached;
  }
  lastFailureAt = Date.now();
  return null;
}

// src/sort-chain.ts
function isNode(value) {
  return typeof value === "object" && value !== null && typeof value.type === "string";
}
var MEMBER_TYPES = /* @__PURE__ */ new Set(["MemberExpression", "OptionalMemberExpression"]);
var CALL_TYPES = /* @__PURE__ */ new Set(["CallExpression", "OptionalCallExpression"]);
function isMemberLike(node) {
  return MEMBER_TYPES.has(node.type);
}
function isCallLike(node) {
  return CALL_TYPES.has(node.type);
}
function nextChainLink(node) {
  if (isMemberLike(node)) return node.object;
  if (isCallLike(node)) return node.callee;
  if (node.type === "TSNonNullExpression") return node.expression;
  return null;
}
function isChainLink(node) {
  return isMemberLike(node) || isCallLike(node) || node.type === "TSNonNullExpression";
}
function isPlainPropAccess(node) {
  return isMemberLike(node) && node.computed === false && node.optional !== true && isNode(node.property) && node.property.type === "Identifier";
}
var orderMapCache = /* @__PURE__ */ new WeakMap();
function getOrderMap(order) {
  if (!order) return null;
  let map = orderMapCache.get(order);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    order.forEach((name, i) => map.set(name, i));
    orderMapCache.set(order, map);
  }
  return map;
}
var fmtToTailwind = (s) => s.replace(/__/g, ".").replace(/_/g, "-").replace(/^\$/, "@").replace(/\$/, "/");
var NEGATIVE_SENTINEL = -1;
function buildUnits(items, twLocalName, orderMap, variantOrderMap) {
  const units = [];
  let i = 0;
  while (i < items.length) {
    const cur = items[i];
    const node = cur.node;
    if (cur.isCallCallee && isPlainPropAccess(node)) {
      const callNode = items[i + 1]?.node;
      if (callNode && isCallLike(callNode)) {
        const propName = node.property.name;
        const args = callNode.arguments ?? [];
        if (args.length === 0 && (propName === "toString" || propName === "valueOf")) {
          units.push({
            kind: "boundary",
            tier: 0,
            order: 0,
            anchorNode: node,
            anchorKey: "object",
            headNode: callNode,
            callNode
          });
          i += 2;
          continue;
        }
        let variantKey = null;
        if (propName === "children") variantKey = "*";
        else if (propName === "descendants") variantKey = "**";
        else if (propName.endsWith("_named") && args.length === 2) {
          variantKey = fmtToTailwind(propName.slice(0, -"_named".length));
        } else if (args.length === 1) {
          variantKey = fmtToTailwind(propName);
        }
        const tier = variantKey !== null ? variantOrderMap?.get(variantKey) : void 0;
        const order = tier !== void 0 ? firstBareOrderOf(args[args.length - 1], twLocalName, orderMap) : 0;
        units.push({
          kind: tier !== void 0 ? "call" : "boundary",
          tier: tier ?? 0,
          order,
          anchorNode: node,
          anchorKey: "object",
          headNode: callNode,
          callNode
        });
        i += 2;
        continue;
      }
    }
    if (!cur.isCallCallee && isPlainPropAccess(node)) {
      const next = items[i + 1];
      if (next && !next.isCallCallee && isMemberLike(next.node) && next.node.computed) {
        units.push({
          kind: "boundary",
          tier: 0,
          order: 0,
          anchorNode: node,
          anchorKey: "object",
          headNode: next.node
        });
        i += 2;
        continue;
      }
      const name = node.property.name;
      const order = orderMap.get(name);
      units.push({
        kind: "bare",
        tier: NEGATIVE_SENTINEL,
        order: order ?? Number.MAX_SAFE_INTEGER,
        anchorNode: node,
        anchorKey: "object",
        headNode: node
      });
      i += 1;
      continue;
    }
    const anchorKey = node.type === "TSNonNullExpression" ? "expression" : "object";
    units.push({
      kind: "boundary",
      tier: 0,
      order: 0,
      anchorNode: node,
      anchorKey,
      headNode: node,
      callNode: isCallLike(node) ? node : void 0
    });
    i += 1;
  }
  return units;
}
function compareUnits(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.order - b.order;
}
function firstBareOrderOf(argNode, twLocalName, orderMap) {
  if (!argNode || !isChainLink(argNode)) return Number.MAX_SAFE_INTEGER;
  const items = [];
  let cur = argNode;
  let nextIsCallCallee = false;
  while (cur && isChainLink(cur)) {
    items.push({ node: cur, isCallCallee: nextIsCallCallee });
    nextIsCallCallee = isCallLike(cur);
    cur = nextChainLink(cur);
  }
  const isTwRoot = !!cur && cur.type === "Identifier" && cur.name === twLocalName;
  const first = items[items.length - 1];
  if (!isTwRoot || !first || first.isCallCallee || !isPlainPropAccess(first.node)) {
    return Number.MAX_SAFE_INTEGER;
  }
  const name = first.node.property.name;
  return orderMap.get(name) ?? Number.MAX_SAFE_INTEGER;
}
function sortTwChains(root, twLocalName, metadata) {
  const visited = /* @__PURE__ */ new Set();
  const orderMap = getOrderMap(metadata.classOrder);
  const variantOrderMap = getOrderMap(metadata.variantOrder);
  if (!orderMap) return;
  function processChain(head) {
    const items = [];
    let cur = head;
    let nextIsCallCallee = false;
    while (cur && isChainLink(cur)) {
      items.push({ node: cur, isCallCallee: nextIsCallCallee });
      nextIsCallCallee = isCallLike(cur);
      cur = nextChainLink(cur);
    }
    const isTwRoot = !!cur && cur.type === "Identifier" && cur.name === twLocalName;
    items.forEach(({ node }) => visited.add(node));
    if (!isTwRoot) {
      for (const { node } of items) walkChildren(node);
      return head;
    }
    items.reverse();
    const rootNode = cur;
    const units = buildUnits(items, twLocalName, orderMap, variantOrderMap);
    for (const u of units) {
      if (!u.callNode) continue;
      const args = u.callNode.arguments;
      args.forEach((arg, idx) => {
        walk(arg, (newArg) => {
          args[idx] = newArg;
        });
      });
    }
    let predecessor = rootNode;
    let run = [];
    const flushRun = () => {
      const sorted = [...run].sort(compareUnits);
      for (const u of sorted) {
        u.anchorNode[u.anchorKey] = predecessor;
        predecessor = u.headNode;
      }
      run = [];
    };
    for (const u of units) {
      if (u.kind === "boundary") {
        flushRun();
        u.anchorNode[u.anchorKey] = predecessor;
        predecessor = u.headNode;
        continue;
      }
      run.push(u);
    }
    flushRun();
    return predecessor;
  }
  function walkChildren(node) {
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      walk(node[key], (newVal) => {
        node[key] = newVal;
      });
    }
  }
  function walk(value, onReplace) {
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        walk(item, (newItem) => {
          value[idx] = newItem;
        });
      });
      return;
    }
    if (!isNode(value)) return;
    const node = value;
    if (isChainLink(node) && !visited.has(node)) {
      const newHead = processChain(node);
      if (newHead !== node) onReplace?.(newHead);
      return;
    }
    if (visited.has(node)) return;
    walkChildren(node);
  }
  walk(root);
}

// src/index.ts
var KNOWN_PACKAGE_NAMES = /* @__PURE__ */ new Set(["typewind-v4", "typewind"]);
function findTwLocalName(ast) {
  const body = Array.isArray(ast.program?.body) ? ast.program.body : ast.body ?? [];
  for (const stmt of body) {
    if (stmt.type !== "ImportDeclaration") continue;
    if (typeof stmt.source?.value !== "string" || !KNOWN_PACKAGE_NAMES.has(stmt.source.value)) continue;
    for (const spec of stmt.specifiers ?? []) {
      if (spec.type === "ImportSpecifier" && spec.imported?.type === "Identifier" && spec.imported.name === "tw") {
        return spec.local.name;
      }
    }
  }
  return "tw";
}
var ownParsers = /* @__PURE__ */ new Set();
var FALLBACK_PARSERS = {
  babel: babelParsers.babel,
  "babel-ts": babelParsers["babel-ts"],
  typescript: typescriptParsers.typescript
};
async function resolveParserCandidate(candidate) {
  if (!candidate) return void 0;
  if (typeof candidate.parse === "function") return candidate;
  if (typeof candidate === "function") {
    const resolved = await candidate();
    if (resolved && typeof resolved.parse === "function") return resolved;
  }
  return void 0;
}
async function resolveBaseParser(name, options) {
  const plugins = options.plugins ?? [];
  let base;
  for (const candidatePlugin of plugins) {
    if (!candidatePlugin) continue;
    const rawCandidate = candidatePlugin.parsers?.[name];
    if (rawCandidate && ownParsers.has(rawCandidate)) continue;
    const resolved = await resolveParserCandidate(rawCandidate);
    if (resolved && !ownParsers.has(resolved)) base = resolved;
  }
  return base ?? FALLBACK_PARSERS[name];
}
function wrapParser(name) {
  const wrapped = {
    ...FALLBACK_PARSERS[name],
    async parse(text, options) {
      const base = await resolveBaseParser(name, options);
      const ast = await base.parse(text, options);
      const metadata = loadTypewindMetadata();
      if (metadata) {
        const twLocalName = findTwLocalName(ast);
        sortTwChains(ast, twLocalName, metadata);
      }
      return ast;
    }
  };
  ownParsers.add(wrapped);
  return wrapped;
}
var plugin = {
  parsers: {
    babel: wrapParser("babel"),
    "babel-ts": wrapParser("babel-ts"),
    typescript: wrapParser("typescript")
  }
};
var { parsers } = plugin;
var index_default = plugin;
export {
  index_default as default,
  parsers
};
