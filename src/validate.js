import { validateRootStructure } from './structure.js';
import { validateRelations } from './relations.js';
import { validateUsage } from './usage.js';
import printInfo from './info.js';
import { readJSONSync } from './utils.js';
import Failure from './Failure.js';

export * from './structure.js';

export const validateAll = (definitions, usageStats) => {
	printInfo(definitions);

	return [
		...Failure.arrayFromSuperstructError(
			validateRootStructure(definitions)
		),
		...validateRelations(definitions),
		...(usageStats && validateUsage(definitions, usageStats) || []),
	];
};

const validateAllFromFile = (path, usageStatsPath) => {
	const definitions = readJSONSync(path);
	const usageStats = usageStatsPath && typeof usageStatsPath === 'string' ? readJSONSync(usageStatsPath) : null;

	return validateAll(definitions, usageStats);
};

export default validateAllFromFile;
