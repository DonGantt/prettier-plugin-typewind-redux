import type { TypewindMetadata } from './utils/metadata';

interface ASTNode {
  type: string;
  [key: string]: any;
}

function isNode(value: unknown): value is ASTNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ASTNode).type === 'string'
  );
}

const MEMBER_TYPES = new Set(['MemberExpression', 'OptionalMemberExpression']);
const CALL_TYPES = new Set(['CallExpression', 'OptionalCallExpression']);

function isMemberLike(node: ASTNode): boolean {
  return MEMBER_TYPES.has(node.type);
}

function isCallLike(node: ASTNode): boolean {
  return CALL_TYPES.has(node.type);
}

function nextChainLink(node: ASTNode): ASTNode | null {
  if (isMemberLike(node)) return node.object;
  if (isCallLike(node)) return node.callee;
  if (node.type === 'TSNonNullExpression') return node.expression;
  return null;
}

function isChainLink(node: ASTNode): boolean {
  return isMemberLike(node) || isCallLike(node) || node.type === 'TSNonNullExpression';
}

function isPlainPropAccess(node: ASTNode): boolean {
  return (
    isMemberLike(node) &&
    node.computed === false &&
    node.optional !== true &&
    isNode(node.property) &&
    node.property.type === 'Identifier'
  );
}

const orderMapCache = new WeakMap<object, Map<string, number>>();

function getOrderMap(order: string[] | undefined): Map<string, number> | null {
  if (!order) return null;
  let map = orderMapCache.get(order);
  if (!map) {
    map = new Map();
    order.forEach((name, i) => map!.set(name, i));
    orderMapCache.set(order, map);
  }
  return map;
}

const fmtToTailwind = (s: string) =>
  s.replace(/__/g, '.').replace(/_/g, '-').replace(/^\$/, '@').replace(/\$/, '/');

// Real Tailwind v4 class order factors into (variant tier, base utility
// order) — verified against the real engine across 15 variants x 20 diverse
// utilities with zero mismatches. A bare (unvaried) utility is always tier
// -1 (sorts before every variant); a call-wrapped utility's tier comes from
// `variantOrder`. A unit we can't confidently classify (arbitrary values,
// unknown calls, non-null assertions, a terminal `.toString()`) is
// 'boundary': never reordered, and it splits the chain into
// independently-sortable runs — same as the old call-boundary behavior.
const NEGATIVE_SENTINEL = -1;

interface Unit {
  kind: 'bare' | 'call' | 'boundary';
  tier: number;
  order: number;
  // The node whose backward-pointing field needs relinking when this unit's
  // position changes, and which field that is.
  anchorNode: ASTNode;
  anchorKey: 'object' | 'expression' | 'callee';
  // The outward-facing node: whatever comes after this unit attaches here.
  headNode: ASTNode;
  // Present for 'call'/'boundary' units whose last node is a call, so its
  // arguments (possibly nested tw-chains) can be recursed into.
  callNode?: ASTNode;
}

function buildUnits(
  items: { node: ASTNode; isCallCallee: boolean }[],
  twLocalName: string,
  orderMap: Map<string, number>,
  variantOrderMap: Map<string, number> | null
): Unit[] {
  const units: Unit[] = [];
  let i = 0;

  while (i < items.length) {
    const cur = items[i];
    const node = cur.node;

    // A variant-wrapper call: the callee member (about to be invoked)
    // followed immediately by its CallExpression.
    if (cur.isCallCallee && isPlainPropAccess(node)) {
      const callNode = items[i + 1]?.node;
      if (callNode && isCallLike(callNode)) {
        const propName = node.property.name as string;
        const args = (callNode.arguments as ASTNode[]) ?? [];

        if (args.length === 0 && (propName === 'toString' || propName === 'valueOf')) {
          units.push({
            kind: 'boundary',
            tier: 0,
            order: 0,
            anchorNode: node,
            anchorKey: 'object',
            headNode: callNode,
            callNode,
          });
          i += 2;
          continue;
        }

        let variantKey: string | null = null;
        if (propName === 'children') variantKey = '*';
        else if (propName === 'descendants') variantKey = '**';
        else if (propName.endsWith('_named') && args.length === 2) {
          variantKey = fmtToTailwind(propName.slice(0, -'_named'.length));
        } else if (args.length === 1) {
          variantKey = fmtToTailwind(propName);
        }

        const tier = variantKey !== null ? variantOrderMap?.get(variantKey) : undefined;
        const order =
          tier !== undefined ? firstBareOrderOf(args[args.length - 1], twLocalName, orderMap) : 0;
        units.push({
          kind: tier !== undefined ? 'call' : 'boundary',
          tier: tier ?? 0,
          order,
          anchorNode: node,
          anchorKey: 'object',
          headNode: callNode,
          callNode,
        });
        i += 2;
        continue;
      }
    }

    // A bare named utility — unless immediately followed by a computed
    // bracket (an arbitrary value, e.g. `content_['"*"']`), which must stay
    // glued to its prefix marker prop rather than being sorted independently.
    if (!cur.isCallCallee && isPlainPropAccess(node)) {
      const next = items[i + 1];
      if (next && !next.isCallCallee && isMemberLike(next.node) && next.node.computed) {
        units.push({
          kind: 'boundary',
          tier: 0,
          order: 0,
          anchorNode: node,
          anchorKey: 'object',
          headNode: next.node,
        });
        i += 2;
        continue;
      }

      const name = node.property.name as string;
      const order = orderMap.get(name);
      units.push({
        kind: 'bare',
        tier: NEGATIVE_SENTINEL,
        order: order ?? Number.MAX_SAFE_INTEGER,
        anchorNode: node,
        anchorKey: 'object',
        headNode: node,
      });
      i += 1;
      continue;
    }

    const anchorKey = node.type === 'TSNonNullExpression' ? 'expression' : 'object';
    units.push({
      kind: 'boundary',
      tier: 0,
      order: 0,
      anchorNode: node,
      anchorKey,
      headNode: node,
      callNode: isCallLike(node) ? node : undefined,
    });
    i += 1;
  }

  return units;
}

function compareUnits(a: Unit, b: Unit): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.order - b.order;
}

// Multiple calls can share the exact same variant (e.g. two separate
// `.hover(...)` calls, or `.hover(tw.A)` next to `.hover(tw.B)`) — ties on
// tier alone would just preserve whatever order they happened to be written
// in, which doesn't match the real engine (same-tier items still sort by
// their own base utility order). Use the first bare class reachable inside
// the call's argument as that representative order.
function firstBareOrderOf(
  argNode: ASTNode | undefined,
  twLocalName: string,
  orderMap: Map<string, number>
): number {
  if (!argNode || !isChainLink(argNode)) return Number.MAX_SAFE_INTEGER;
  const items: { node: ASTNode; isCallCallee: boolean }[] = [];
  let cur: ASTNode | null = argNode;
  let nextIsCallCallee = false;
  while (cur && isChainLink(cur)) {
    items.push({ node: cur, isCallCallee: nextIsCallCallee });
    nextIsCallCallee = isCallLike(cur);
    cur = nextChainLink(cur);
  }
  const isTwRoot = !!cur && cur.type === 'Identifier' && cur.name === twLocalName;
  const first = items[items.length - 1];
  if (!isTwRoot || !first || first.isCallCallee || !isPlainPropAccess(first.node)) {
    return Number.MAX_SAFE_INTEGER;
  }
  const name = first.node.property.name as string;
  return orderMap.get(name) ?? Number.MAX_SAFE_INTEGER;
}

export function sortTwChains(
  root: ASTNode,
  twLocalName: string,
  metadata: TypewindMetadata
): void {
  const visited = new Set<ASTNode>();
  const orderMap = getOrderMap(metadata.classOrder);
  const variantOrderMap = getOrderMap(metadata.variantOrder);
  if (!orderMap) return;

  // `processChain` returns the (possibly new) head node for this chain so
  // the caller can splice it back into whatever held the original reference
  // — reordering a call-wrapped segment relative to a bare one means
  // literally relinking `.object`/`.expression` pointers, not just renaming
  // identifiers in place, so the new head may be a different node entirely.
  function processChain(head: ASTNode): ASTNode {
    const items: { node: ASTNode; isCallCallee: boolean }[] = [];
    let cur: ASTNode | null = head;
    let nextIsCallCallee = false;
    while (cur && isChainLink(cur)) {
      items.push({ node: cur, isCallCallee: nextIsCallCallee });
      nextIsCallCallee = isCallLike(cur);
      cur = nextChainLink(cur);
    }

    const isTwRoot = !!cur && cur.type === 'Identifier' && cur.name === twLocalName;
    items.forEach(({ node }) => visited.add(node));

    if (!isTwRoot) {
      for (const { node } of items) walkChildren(node);
      return head;
    }

    items.reverse();
    const rootNode = cur as ASTNode;
    const units = buildUnits(items, twLocalName, orderMap!, variantOrderMap);

    // Recurse into every call unit's own arguments (possibly a nested
    // tw-chain) regardless of whether THIS level ends up reordering.
    for (const u of units) {
      if (!u.callNode) continue;
      const args = u.callNode.arguments as ASTNode[];
      args.forEach((arg, idx) => {
        walk(arg, (newArg) => {
          args[idx] = newArg;
        });
      });
    }

    // Partition into runs separated by boundaries; stable-sort each run by
    // (tier, order), then relink every unit's backward pointer to whatever
    // now immediately precedes it. Boundaries never move, but their own
    // anchor may still need to point at a different (just-reordered) node.
    let predecessor = rootNode;
    let run: Unit[] = [];
    const flushRun = () => {
      const sorted = [...run].sort(compareUnits);
      for (const u of sorted) {
        u.anchorNode[u.anchorKey] = predecessor;
        predecessor = u.headNode;
      }
      run = [];
    };

    for (const u of units) {
      if (u.kind === 'boundary') {
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

  function walkChildren(node: ASTNode): void {
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      walk(node[key], (newVal) => {
        node[key] = newVal;
      });
    }
  }

  function walk(value: unknown, onReplace?: (newValue: ASTNode) => void): void {
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
