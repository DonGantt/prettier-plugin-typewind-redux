import { parsers as babelParsers } from 'prettier/plugins/babel';
import { parsers as typescriptParsers } from 'prettier/plugins/typescript';
import { sortTwChains } from '../src/sort-chain';
import type { TypewindMetadata } from '../src/utils/metadata';

const metadata: TypewindMetadata = {
  variants: [],
  classSet: [],
  valueIndex: {},
  rootFontSize: 16,
  classOrder: ['flex', 'items_center', 'justify_center', 'gap_3', 'bg_gray_500', 'text_gray_200'],
};

function parse(code: string) {
  return babelParsers.babel.parse(code, {} as any) as any;
}

function programBody(ast: any) {
  return ast.program.body;
}

function parseTS(code: string) {
  return typescriptParsers.typescript.parse(code, {} as any) as any;
}

function tsProgramBody(ast: any) {
  return ast.body;
}

describe('sortTwChains', () => {
  it('sorts a plain out-of-order chain into canonical order', () => {
    const ast = parse(`const x = tw.items_center.flex;`);
    sortTwChains(ast, 'tw', metadata);
    const init = programBody(ast)[0].declarations[0].init;
    expect(init.object.property.name).toBe('flex');
    expect(init.property.name).toBe('items_center');
  });

  it('leaves an already-sorted chain unchanged', () => {
    const ast = parse(`const x = tw.flex.items_center.justify_center;`);
    sortTwChains(ast, 'tw', metadata);
    const outer = programBody(ast)[0].declarations[0].init;
    expect(outer.property.name).toBe('justify_center');
    expect(outer.object.property.name).toBe('items_center');
    expect(outer.object.object.property.name).toBe('flex');
  });

  it('does not reorder across a call boundary', () => {
    const ast = parse(`const x = tw.items_center.flex.hover(tw.text_gray_200.bg_gray_500);`);
    sortTwChains(ast, 'tw', metadata);
    const call = programBody(ast)[0].declarations[0].init;
    expect(call.type).toBe('CallExpression');
    expect(call.callee.property.name).toBe('hover');
    expect(call.callee.object.property.name).toBe('items_center');
    expect(call.callee.object.object.property.name).toBe('flex');

    const arg = call.arguments[0];
    expect(arg.property.name).toBe('text_gray_200');
    expect(arg.object.property.name).toBe('bg_gray_500');
  });

  it('recurses into nested call arguments independently', () => {
    const ast = parse(
      `const x = tw.items_center.flex.hover(tw.text_gray_200.bg_gray_500).sm(tw.justify_center.gap_3);`
    );
    sortTwChains(ast, 'tw', metadata);
    const outerCall = programBody(ast)[0].declarations[0].init;
    expect(outerCall.callee.property.name).toBe('sm');

    const smArg = outerCall.arguments[0];
    expect(smArg.property.name).toBe('gap_3');
    expect(smArg.object.property.name).toBe('justify_center');

    const hoverCall = outerCall.callee.object;
    expect(hoverCall.callee.property.name).toBe('hover');
    const hoverArg = hoverCall.arguments[0];
    expect(hoverArg.property.name).toBe('text_gray_200');
    expect(hoverArg.object.property.name).toBe('bg_gray_500');
  });

  it('respects an aliased tw import local name', () => {
    const ast = parse(`import { tw as twx } from 'typewind-v4'; const x = twx.items_center.flex;`);
    sortTwChains(ast, 'twx', metadata);
    const init = programBody(ast)[1].declarations[0].init;
    expect(init.object.property.name).toBe('flex');
    expect(init.property.name).toBe('items_center');
  });

  it('ignores chains not rooted at the tracked tw identifier', () => {
    const ast = parse(`const x = other.items_center.flex;`);
    sortTwChains(ast, 'tw', metadata);
    const init = programBody(ast)[0].declarations[0].init;
    expect(init.property.name).toBe('flex');
    expect(init.object.property.name).toBe('items_center');
  });

  it('treats unknown props as sorting after known ones, preserving relative order', () => {
    const ast = parse(`const x = tw.flex.unknown_prop_b.unknown_prop_a.items_center;`);
    sortTwChains(ast, 'tw', metadata);
    const names: string[] = [];
    let node = programBody(ast)[0].declarations[0].init;
    while (node.type === 'MemberExpression') {
      names.unshift(node.property.name);
      node = node.object;
    }
    expect(names).toEqual(['flex', 'items_center', 'unknown_prop_b', 'unknown_prop_a']);
  });

  it('treats a computed/arbitrary-value access as a run boundary', () => {
    const ast = parse(
      `const x = tw.items_center.flex.gap_['12px'].text_gray_200.bg_gray_500;`
    );
    sortTwChains(ast, 'tw', metadata);
    const outer = programBody(ast)[0].declarations[0].init;

    expect(outer.property.name).toBe('text_gray_200');
    const postRunInner = outer.object;
    expect(postRunInner.property.name).toBe('bg_gray_500');

    const computed = postRunInner.object;
    expect(computed.computed).toBe(true);
    expect(computed.property.value).toBe('12px');

    expect(computed.object.property.name).toBe('gap_');
    expect(computed.object.object.property.name).toBe('items_center');
    expect(computed.object.object.object.property.name).toBe('flex');
  });

  it('never reorders a link where "?." actually appears, to avoid changing short-circuit semantics', () => {
    const ast = parse(`const x = tw?.items_center?.flex;`);
    sortTwChains(ast, 'tw', metadata);
    const init = programBody(ast)[0].declarations[0].init;
    expect(init.type).toBe('OptionalMemberExpression');
    expect(init.optional).toBe(true);
    expect(init.property.name).toBe('flex');
    expect(init.object.optional).toBe(true);
    expect(init.object.property.name).toBe('items_center');
  });

  it('still sorts a run of non-optional links that follow an optional chain root', () => {
    const ast = parse(`const x = tw?.justify_center.items_center.flex;`);
    sortTwChains(ast, 'tw', metadata);
    const init = programBody(ast)[0].declarations[0].init;
    expect(init.optional).toBe(false);
    expect(init.property.name).toBe('items_center');

    const middle = init.object;
    expect(middle.optional).toBe(false);
    expect(middle.property.name).toBe('flex');

    const root = middle.object;
    expect(root.optional).toBe(true);
    expect(root.property.name).toBe('justify_center');
  });

  it('treats a TS non-null assertion as a boundary but still sorts around it', () => {
    const ast = parseTS(`const x = tw.items_center!.justify_center.flex;`);
    sortTwChains(ast, 'tw', metadata);
    const outer = tsProgramBody(ast)[0].declarations[0].init;
    expect(outer.property.name).toBe('justify_center');

    const postAssertion = outer.object;
    expect(postAssertion.property.name).toBe('flex');

    const nonNull = postAssertion.object;
    expect(nonNull.type).toBe('TSNonNullExpression');
    expect(nonNull.expression.property.name).toBe('items_center');
  });
});
