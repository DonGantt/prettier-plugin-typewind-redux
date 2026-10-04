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

const orderMapCache = new WeakMap<TypewindMetadata, Map<string, number>>();

function getOrderMap(metadata: TypewindMetadata): Map<string, number> {
  let map = orderMapCache.get(metadata);
  if (!map) {
    map = new Map();
    const order = metadata.classOrder ?? [];
    order.forEach((name, i) => map!.set(name, i));
    orderMapCache.set(metadata, map);
  }
  return map;
}

function getClassOrderIndex(orderMap: Map<string, number>, name: string): number {
  const idx = orderMap.get(name);
  return idx === undefined ? Number.MAX_SAFE_INTEGER : idx;
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

function sortRun(nodes: ASTNode[], orderMap: Map<string, number>): void {
  if (nodes.length < 2) return;
  const names = nodes.map((n) => n.property.name as string);
  const sorted = [...names].sort(
    (a, b) => getClassOrderIndex(orderMap, a) - getClassOrderIndex(orderMap, b)
  );
  nodes.forEach((node, i) => {
    node.property.name = sorted[i];
  });
}

export function sortTwChains(
  root: ASTNode,
  twLocalName: string,
  metadata: TypewindMetadata
): void {
  const visited = new Set<ASTNode>();
  const orderMap = getOrderMap(metadata);

  function processChain(head: ASTNode): void {
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
      for (const { node } of items) {
        walkChildren(node);
      }
      return;
    }

    items.reverse();

    let run: ASTNode[] = [];
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

  function walkChildren(node: ASTNode): void {
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      walk(node[key]);
    }
  }

  function walk(value: unknown): void {
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
