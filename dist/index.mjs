var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
import { parsers as babelParsers } from "prettier/plugins/babel";
import { parsers as typescriptParsers } from "prettier/plugins/typescript";

// src/utils/metadata.ts
import * as fs2 from "fs";

// src/utils/v3-adapter.ts
import * as fs from "fs";
import * as path from "path";
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
    const requireFromProject = (id) => __require(__require.resolve(id, { paths: [configDir] }));
    const resolveConfig = requireFromProject("tailwindcss/resolveConfig");
    const { createContext } = requireFromProject("tailwindcss/lib/lib/setupContextUtils");
    const { generateRules } = requireFromProject("tailwindcss/lib/lib/generateRules");
    const postcss = requireFromProject("postcss");
    const cacheKeysBefore = new Set(Object.keys(__require.cache));
    delete __require.cache[__require.resolve(configPath)];
    const userConfig = __require(configPath);
    for (const key of Object.keys(__require.cache)) {
      if (!cacheKeysBefore.has(key) && !key.includes(`${path.sep}node_modules${path.sep}`)) {
        delete __require.cache[key];
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
        for (const [, rule] of rules) root.append(rule.clone());
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
var V3_RECHECK_INTERVAL_MS = 2e3;
var cached;
var lastFailureAt = 0;
var cachedV3Fingerprint;
var lastV3CheckAt = 0;
function loadV4Metadata() {
  try {
    const metaPath = __require.resolve("typewind-v4/dist/_metadata.json");
    const raw = fs2.readFileSync(metaPath, "utf8");
    return JSON.parse(raw);
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
function loadTypewindMetadata() {
  if (cached !== void 0 && cachedV3Fingerprint) {
    const now = Date.now();
    if (now - lastV3CheckAt >= V3_RECHECK_INTERVAL_MS) {
      lastV3CheckAt = now;
      if (hasV3ConfigChanged()) {
        cached = void 0;
        cachedV3Fingerprint = void 0;
      }
    }
  }
  if (cached !== void 0) return cached;
  if (lastFailureAt !== 0 && Date.now() - lastFailureAt < RETRY_INTERVAL_MS) return null;
  const v4Result = loadV4Metadata();
  if (v4Result) {
    cached = v4Result;
    return cached;
  }
  const v3Result = buildV3Metadata();
  if (v3Result) {
    cached = v3Result;
    cachedV3Fingerprint = getConfigFingerprint(process.cwd()) ?? void 0;
    lastV3CheckAt = Date.now();
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
var orderMapCache = /* @__PURE__ */ new WeakMap();
function getOrderMap(metadata) {
  let map = orderMapCache.get(metadata);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    const order = metadata.classOrder ?? [];
    order.forEach((name, i) => map.set(name, i));
    orderMapCache.set(metadata, map);
  }
  return map;
}
function getClassOrderIndex(orderMap, name) {
  const idx = orderMap.get(name);
  return idx === void 0 ? Number.MAX_SAFE_INTEGER : idx;
}
function isPlainPropAccess(node) {
  return isMemberLike(node) && node.computed === false && node.optional !== true && isNode(node.property) && node.property.type === "Identifier";
}
function sortRun(nodes, orderMap) {
  if (nodes.length < 2) return;
  const names = nodes.map((n) => n.property.name);
  const sorted = [...names].sort(
    (a, b) => getClassOrderIndex(orderMap, a) - getClassOrderIndex(orderMap, b)
  );
  nodes.forEach((node, i) => {
    node.property.name = sorted[i];
  });
}
function sortTwChains(root, twLocalName, metadata) {
  const visited = /* @__PURE__ */ new Set();
  const orderMap = getOrderMap(metadata);
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
      for (const { node } of items) {
        walkChildren(node);
      }
      return;
    }
    items.reverse();
    let run = [];
    const flushRun = () => {
      sortRun(run, orderMap);
      run = [];
    };
    for (const { node, isCallCallee } of items) {
      if (!isCallCallee && isPlainPropAccess(node)) {
        run.push(node);
      } else {
        flushRun();
        if (isCallLike(node)) {
          for (const arg of node.arguments) walk(arg);
        } else if (isMemberLike(node) && node.computed) {
          walk(node.property);
        }
      }
    }
    flushRun();
  }
  function walkChildren(node) {
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      walk(node[key]);
    }
  }
  function walk(value) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!isNode(value)) return;
    const node = value;
    if (isChainLink(node) && !visited.has(node)) {
      processChain(node);
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
function wrapParser(parser) {
  return {
    ...parser,
    parse(text, options) {
      const ast = parser.parse(text, options);
      const metadata = loadTypewindMetadata();
      if (metadata) {
        const twLocalName = findTwLocalName(ast);
        sortTwChains(ast, twLocalName, metadata);
      }
      return ast;
    }
  };
}
var plugin = {
  parsers: {
    babel: wrapParser(babelParsers.babel),
    "babel-ts": wrapParser(babelParsers["babel-ts"]),
    typescript: wrapParser(typescriptParsers.typescript)
  }
};
var index_default = plugin;
export {
  index_default as default
};
