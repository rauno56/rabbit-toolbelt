import { validateRootStructure } from './structure.js';
import { validateRelations } from './relations.js';
import { readJSONSync } from './utils.js';

export * from './structure.js';

const validateFromFile = (path) => {
	const definitions = readJSONSync(path);
	const structureResult = validateRootStructure(definitions);
	if (structureResult[0]) {
		return structureResult;
	}
	return validateRelations(definitions);
};

export default validateFromFile;
