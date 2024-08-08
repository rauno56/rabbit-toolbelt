import assert from 'node:assert/strict';
import Index from './Index.js';
import { readJSONSync } from './utils.js';

export const merge = (ignoreIndex = null, ...filePaths) => {
	const index = new Index();

	assert(filePaths.length, 'No files provided');

	for (const filePath of filePaths) {
		const definitions = readJSONSync(filePath);
		index.merge(definitions, true, ignoreIndex, filePath);
	}

	return index;
};

export default merge;
