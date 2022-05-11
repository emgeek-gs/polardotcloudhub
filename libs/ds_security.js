const path = require('path');
const security = require('./security');

const checkAllowedPath = (ddbPath, inputPath) => {
    security.pathTraversalCheck(ddbPath, inputPath);

    // Don't allow direct writes / reads to .ddb subfolders
    if (path.resolve(ddbPath, inputPath).indexOf(path.join(ddbPath, ".ddb")) === 0) throw new Error(`Invalid path: ${inputPath}`);
}
const checkAllowedBuildPath = (ddbPath, inputPath) => {
    security.pathTraversalCheck(ddbPath, inputPath);

    if (path.resolve(ddbPath, inputPath).indexOf(path.join(ddbPath, ".ddb")) !== 0) throw new Error(`Invalid build path: ${inputPath}`);
}

module.exports = {
    checkAllowedPath,
    checkAllowedBuildPath
}