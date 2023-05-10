import { validateRootStructure } from './structure.js';
import { validateRelations } from './relations.js';
import { validateUsage } from './usage.js';
import printInfo from './info.js';
import { readJSONSync } from './utils.js';
import Failure from './Failure.js';

export * from './structure.js';

// validateUsage if usageStatsPath is set
const condValidateUsage = (definitions, usageStatsPath) => {
	if (usageStatsPath && typeof usageStatsPath === 'string') {
		return validateUsage(definitions, readJSONSync(usageStatsPath));
	}
	return [];
};

const validateFromFile = (path, usageStatsPath) => {
	const definitions = readJSONSync(path);

	printInfo(definitions);

	return [
		...Failure.arrayFromSuperstructError(
			validateRootStructure(definitions)
		),
		...validateRelations(definitions),
		...condValidateUsage(definitions, usageStatsPath),
	];
};

export default validateFromFile;
