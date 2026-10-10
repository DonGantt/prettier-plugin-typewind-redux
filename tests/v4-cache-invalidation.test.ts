import * as fs from 'fs';
import * as path from 'path';

describe('v4 metadata cache invalidation', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;
  let metaPath: string;

  function writeMetadata(classOrder: string[]) {
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ variants: [], classSet: [], valueIndex: {}, rootFontSize: 16, classOrder }),
      'utf8'
    );
  }

  beforeEach(() => {
    const fixturesRoot = path.join(__dirname, 'fixtures');
    tmpDir = fs.mkdtempSync(path.join(fixturesRoot, 'tmp-v4-cache-test-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'tmp-project' }));

    const pkgDir = path.join(tmpDir, 'node_modules', 'typewind-v4');
    fs.mkdirSync(path.join(pkgDir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'typewind-v4', exports: { './dist/*': './dist/*' } })
    );
    metaPath = path.join(pkgDir, 'dist', '_metadata.json');
    writeMetadata(['flex']);
  });

  afterEach(() => {
    jest.resetModules();
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reloads metadata when the typewind-v4 metadata file changes on disk', () => {
    process.chdir(tmpDir);

    const { loadTypewindMetadata, resetTypewindMetadataCache } = require('../src/utils/metadata');
    resetTypewindMetadataCache();

    const first = loadTypewindMetadata();
    expect(first).not.toBeNull();
    expect(first.classOrder).toEqual(['flex']);

    const second = loadTypewindMetadata();
    expect(second).toBe(first);

    const future = new Date(Date.now() + 5000);
    writeMetadata(['items_center', 'flex']);
    fs.utimesSync(metaPath, future, future);

    const realNow = Date.now;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 3000);
    const third = loadTypewindMetadata();
    jest.spyOn(Date, 'now').mockRestore();

    expect(third).not.toBe(first);
    expect(third.classOrder).toEqual(['items_center', 'flex']);
  });

  it('does not re-check the metadata file within the throttle window', () => {
    process.chdir(tmpDir);

    const { loadTypewindMetadata, resetTypewindMetadataCache } = require('../src/utils/metadata');
    resetTypewindMetadataCache();

    const first = loadTypewindMetadata();
    expect(first).not.toBeNull();

    const future = new Date(Date.now() + 5000);
    writeMetadata(['items_center', 'flex']);
    fs.utimesSync(metaPath, future, future);

    const second = loadTypewindMetadata();
    expect(second).toBe(first);
  });
});
