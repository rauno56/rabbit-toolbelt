import { validateRootStructure } from './structure.js';
import { validateRelations } from './relations.js';
import { readJSONSync } from './utils.js';
import Failure from './Failure.js';

export * from './structure.js';

const validateFromFile = (path) => {
	const definitions = readJSONSync(path);
	return [
		...Failure.arrayFromSuperstructError(
			validateRootStructure(definitions)
		),
		...validateRelations(definitions),
	];
};

export default validateFromFile;
