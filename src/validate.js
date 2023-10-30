import { validateRootStructure } from './structure.js';
import { validateRelations } from './relations.js';
import { validateUsage } from './usage.js';
import printInfo from './info.js';
import { readJSONSync } from './utils.js';
import Failure from './Failure.js';

export * from './structure.js';

const tryCollect = (fn) => {
	try {
		return fn() || [];
	} catch (err) {
		return [err];
	}
};

export const validateAll = (definitions, usageStats) => {
	printInfo(definitions);

	return [
		...(tryCollect(() => Failure.arrayFromSuperstructError(validateRootStructure(definitions)))),
		...(tryCollect(() => validateRelations(definitions))),
		...(tryCollect(() => usageStats && validateUsage(definitions, usageStats))),
	];
};

const validateAllFromFile = (path, usageStatsPath) => {
	const definitions = readJSONSync(path);
	const usageStats = usageStatsPath && typeof usageStatsPath === 'string' ? readJSONSync(usageStatsPath) : null;

	return validateAll(definitions, usageStats);
};

export default validateAllFromFile;
