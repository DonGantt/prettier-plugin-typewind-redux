import * as fs from 'fs';
import * as path from 'path';

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

describe('v3 metadata cache invalidation', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    const fixturesRoot = path.join(__dirname, 'fixtures');
    tmpDir = fs.mkdtempSync(path.join(fixturesRoot, 'tmp-cache-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'tailwind.config.js'),
      `module.exports = { content: ['./index.html'], theme: { extend: {} }, plugins: [] };\n`
    );
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<div class="flex"></div>');
  });

  afterEach(() => {
    jest.resetModules();
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rebuilds metadata when the tailwind config file changes on disk', () => {
    process.chdir(tmpDir);

    const { loadTypewindMetadata, resetTypewindMetadataCache } = require('../src/utils/metadata');
    resetTypewindMetadataCache();

    const first = loadTypewindMetadata();
    expect(first).not.toBeNull();
    const firstOrderLength = first.classOrder.length;

    const second = loadTypewindMetadata();
    expect(second).toBe(first);

    const future = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(tmpDir, 'tailwind.config.js'), future, future);

    const realNow = Date.now;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 3000);
    const third = loadTypewindMetadata();
    jest.spyOn(Date, 'now').mockRestore();

    expect(third).not.toBe(first);
    expect(third.classOrder.length).toBe(firstOrderLength);
  });

  it('does not re-check the config file within the throttle window', () => {
    process.chdir(tmpDir);

    const { loadTypewindMetadata, resetTypewindMetadataCache } = require('../src/utils/metadata');
    resetTypewindMetadataCache();

    const first = loadTypewindMetadata();
    expect(first).not.toBeNull();

    const future = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(tmpDir, 'tailwind.config.js'), future, future);

    const second = loadTypewindMetadata();
    expect(second).toBe(first);
  });
});
