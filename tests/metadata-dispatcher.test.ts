import * as path from 'path';
import { parsers as babelParsers } from 'prettier/plugins/babel';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'v3-project');

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    readFileSync: (filePath: unknown, ...rest: unknown[]) => {
      if (typeof filePath === 'string' && filePath.endsWith('_metadata.json')) {
        throw new Error('simulated: typewind-v4 metadata not found');
      }
      return actual.readFileSync(filePath, ...rest);
    },
  };
});

describe('loadTypewindMetadata dispatcher', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    jest.resetModules();
    process.chdir(originalCwd);
  });

  it('falls back to the v3 adapter and sorts a chain correctly', () => {
    process.chdir(FIXTURE_DIR);

    const { loadTypewindMetadata, resetTypewindMetadataCache } = require('../src/utils/metadata');
    const { sortTwChains } = require('../src/sort-chain');
    resetTypewindMetadataCache();

    const metadata = loadTypewindMetadata();
    expect(metadata).not.toBeNull();
    expect(metadata.classOrder).toContain('flex');

    const ast = babelParsers.babel.parse(`const x = tw.items_center.flex;`, {} as any) as any;
    sortTwChains(ast, 'tw', metadata);
    const init = ast.program.body[0].declarations[0].init;
    expect(init.object.property.name).toBe('flex');
    expect(init.property.name).toBe('items_center');
  });
});
