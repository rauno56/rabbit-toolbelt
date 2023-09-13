import { readFileSync } from 'node:fs';

export const readJSONSync = (path) => {
	return JSON.parse(readFileSync(path, 'utf8'));
};

export const getOpt = (option) => {
	const index = process.argv.indexOf(option);
	if (~index) {
		process.argv.splice(index, 1);
		return true;
	}
	return false;
};
