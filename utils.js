import { readFileSync } from 'node:fs';

export const readJSONSync = (path) => {
	return JSON.parse(readFileSync(path, 'utf8'));
};
