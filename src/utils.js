import url from 'node:url';
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

export const parseUrl = (input) => {
	const u = new URL(input);
	const {
		username,
		password,
	} = u;
	const baseUrl = url.format(u, { auth: false });
	return {
		username,
		password,
		baseUrl,
	};
};
