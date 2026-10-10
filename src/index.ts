import type { Parser, ParserOptions, Plugin } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { parsers as typescriptParsers } from 'prettier/plugins/typescript';
import { loadTypewindMetadata } from './utils/metadata';
import { sortTwChains } from './sort-chain';

interface ASTNode {
  type: string;
  [key: string]: any;
}

const KNOWN_PACKAGE_NAMES = new Set(['typewind-v4', 'typewind']);

function findTwLocalName(ast: ASTNode): string {
  const body: ASTNode[] = Array.isArray(ast.program?.body) ? ast.program.body : ast.body ?? [];
  for (const stmt of body) {
    if (stmt.type !== 'ImportDeclaration') continue;
    if (typeof stmt.source?.value !== 'string' || !KNOWN_PACKAGE_NAMES.has(stmt.source.value)) continue;
    for (const spec of stmt.specifiers ?? []) {
      if (
        spec.type === 'ImportSpecifier' &&
        spec.imported?.type === 'Identifier' &&
        spec.imported.name === 'tw'
      ) {
        return spec.local.name;
      }
    }
  }
  return 'tw';
}

const ownParsers = new Set<Parser>();

const FALLBACK_PARSERS: Record<string, Parser> = {
  babel: babelParsers.babel,
  'babel-ts': babelParsers['babel-ts'],
  typescript: typescriptParsers.typescript,
};

async function resolveParserCandidate(candidate: unknown): Promise<Parser | undefined> {
  if (!candidate) return undefined;
  if (typeof (candidate as Parser).parse === 'function') return candidate as Parser;
  if (typeof candidate === 'function') {
    const resolved = await (candidate as () => Parser | Promise<Parser>)();
    if (resolved && typeof resolved.parse === 'function') return resolved;
  }
  return undefined;
}

async function resolveBaseParser(name: string, options: ParserOptions): Promise<Parser> {
  const plugins = (options.plugins ?? []) as Plugin[];
  let base: Parser | undefined;
  for (const candidatePlugin of plugins) {
    if (!candidatePlugin) continue;
    const rawCandidate = candidatePlugin.parsers?.[name];
    if (rawCandidate && ownParsers.has(rawCandidate as Parser)) continue;
    const resolved = await resolveParserCandidate(rawCandidate);
    if (resolved && !ownParsers.has(resolved)) base = resolved;
  }
  return base ?? FALLBACK_PARSERS[name];
}

function wrapParser(name: string): Parser {
  const wrapped: Parser = {
    ...FALLBACK_PARSERS[name],
    async parse(text, options) {
      const base = await resolveBaseParser(name, options as ParserOptions);
      const ast = (await base.parse(text, options)) as unknown as ASTNode;
      const metadata = loadTypewindMetadata();
      if (metadata) {
        const twLocalName = findTwLocalName(ast);
        sortTwChains(ast, twLocalName, metadata);
      }
      return ast as any;
    },
  };
  ownParsers.add(wrapped);
  return wrapped;
}

const plugin: Plugin = {
  parsers: {
    babel: wrapParser('babel'),
    'babel-ts': wrapParser('babel-ts'),
    typescript: wrapParser('typescript'),
  },
};

export const { parsers } = plugin;

export default plugin;
