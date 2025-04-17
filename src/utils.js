import assert from 'node:assert/strict';
import path from 'node:path';
import url from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { inspect } from 'node:util';

export const copy = (obj) => {
	return JSON.parse(JSON.stringify(obj));
};

export const readJSONSync = (path) => {
	return JSON.parse(readFileSync(path, 'utf8'));
};

export const writeJSONSync = (path, content) => {
	return writeFileSync(path, JSON.stringify(content, null, 2));
};

export const readIgnoreFileSync = (path) => {
	return readFileSync(path, 'utf8')
		.split(/[\r\n]+/)
		.filter((line) => line && line.startsWith('/'));
};

export const getOpt = (option) => {
	const index = process.argv.indexOf(option);
	if (~index) {
		process.argv.splice(index, 1);
		return true;
	}
	return false;
};

export const getOptValue = (option) => {
	const index = process.argv.indexOf(option);
	if (~index) {
		const [, value] = process.argv.splice(index, 2);
		return value;
	}
	return null;
};

export const pathResolve = (input) => {
	if (URL.canParse(input)) {
		return new URL(input);
	}
	return path.resolve(input);
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

export const noop = () => {};
export const returnEmptyString = () => '';

export const assertStr = (str, key) => {
	assert.equal(
		typeof str, 'string',
		`Expected ${key ? ('"' + key + '" ') : ''}to be string: ${str}`
	);
};
export const assertStrObj = (obj, key) => {
	assert.equal(
		typeof obj[key], 'string',
		`Expected "${key}" on ${inspect(obj)} to be string: ${obj[key]}`
	);
};
export const assertObj = (obj) => {
	assert.equal(obj && typeof obj, 'object', `Expected to be object: ${obj}`);
};
