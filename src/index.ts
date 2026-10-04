import type { Parser, Plugin } from 'prettier';
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

function wrapParser(parser: Parser): Parser {
  return {
    ...parser,
    parse(text, options) {
      const ast = parser.parse(text, options) as unknown as ASTNode;
      const metadata = loadTypewindMetadata();
      if (metadata) {
        const twLocalName = findTwLocalName(ast);
        sortTwChains(ast, twLocalName, metadata);
      }
      return ast as any;
    },
  };
}

const plugin: Plugin = {
  parsers: {
    babel: wrapParser(babelParsers.babel),
    'babel-ts': wrapParser(babelParsers['babel-ts']),
    typescript: wrapParser(typescriptParsers.typescript),
  },
};

export default plugin;
