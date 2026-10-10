import type { Parser, Plugin } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
const typewindModule = require('../dist/index.js');
const typewindPlugin = typewindModule.default as Plugin;

const SOURCE = `const x = <div className="z-10 flex" tw={tw.items_center.flex} />;\n`;

function sortClassNameAttrs(node: any) {
  if (!node || typeof node !== 'object') return;
  if (
    node.type === 'JSXAttribute' &&
    node.name?.name === 'className' &&
    node.value?.type === 'StringLiteral'
  ) {
    node.value.value = node.value.value.split(' ').sort().join(' ');
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach(sortClassNameAttrs);
    else if (child && typeof child === 'object') sortClassNameAttrs(child);
  }
}

function makeFakeClassSorterPlugin(): Plugin {
  const wrap = (base: Parser): Parser => ({
    ...base,
    async parse(text, options) {
      const ast = await base.parse(text, options);
      sortClassNameAttrs(ast);
      return ast;
    },
  });
  return { parsers: { babel: wrap(babelParsers.babel) } };
}

function findJsxAttrValue(ast: any, name: string): string {
  let found = '';
  const visit = (node: any) => {
    if (!node || typeof node !== 'object' || found) return;
    if (node.type === 'JSXAttribute' && node.name?.name === name && node.value?.type === 'StringLiteral') {
      found = node.value.value;
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ast);
  return found;
}

function findTwChainOrder(ast: any): string[] {
  const order: string[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXExpressionContainer') {
      let cur = node.expression;
      const names: string[] = [];
      while (cur?.type === 'MemberExpression') {
        if (cur.property?.type === 'Identifier') names.unshift(cur.property.name);
        cur = cur.object;
      }
      if (names.length) {
        order.push(...names);
        return;
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ast);
  return order;
}

describe('composing with another parser-wrapping plugin', () => {
  it('applies both sorts when given another plugin before it in options.plugins', async () => {
    const fake = makeFakeClassSorterPlugin();
    const ast = (await typewindPlugin.parsers!.babel.parse(SOURCE, { plugins: [typewindPlugin, fake] } as any)) as any;
    expect(findJsxAttrValue(ast, 'className')).toBe('flex z-10');
    expect(findTwChainOrder(ast)).toEqual(['flex', 'items_center']);
  });

  it('applies both sorts regardless of array order (fake listed first)', async () => {
    const fake = makeFakeClassSorterPlugin();
    const ast = (await typewindPlugin.parsers!.babel.parse(SOURCE, { plugins: [fake, typewindPlugin] } as any)) as any;
    expect(findJsxAttrValue(ast, 'className')).toBe('flex z-10');
    expect(findTwChainOrder(ast)).toEqual(['flex', 'items_center']);
  });

  it('falls back to the built-in babel parser when no other plugin registers it', async () => {
    const ast = (await typewindPlugin.parsers!.babel.parse(SOURCE, { plugins: [typewindPlugin] } as any)) as any;
    expect(findJsxAttrValue(ast, 'className')).toBe('z-10 flex');
    expect(findTwChainOrder(ast)).toEqual(['flex', 'items_center']);
  });

  it('does not recurse into itself when its own parser is the only entry in options.plugins', async () => {
    const ast = (await typewindPlugin.parsers!.babel.parse(SOURCE, {
      plugins: [{ parsers: typewindPlugin.parsers }],
    } as any)) as any;
    expect(findTwChainOrder(ast)).toEqual(['flex', 'items_center']);
  });

  it('exposes parsers as a named export, not only nested under default', () => {
    expect(typewindModule.parsers).toBeDefined();
    expect(typewindModule.parsers).toBe(typewindModule.default.parsers);
    expect(Object.keys(typewindModule.parsers)).toEqual(
      expect.arrayContaining(['babel', 'babel-ts', 'typescript'])
    );
  });
});
