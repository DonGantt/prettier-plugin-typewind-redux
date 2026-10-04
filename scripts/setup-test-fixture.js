const fs = require('fs');
const path = require('path');

const typewindEntry = require.resolve('typewind-v4');
const metadataPath = path.join(path.dirname(typewindEntry), '_metadata.json');
const fixturePath = path.join(__dirname, '..', 'tests', 'fixtures', 'typewind-v4-metadata.json');

fs.copyFileSync(fixturePath, metadataPath);
