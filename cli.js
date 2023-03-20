#!/usr/bin/env node

import path from 'node:path';
import { strict as assert } from 'assert';
import {
	validateFromFile,
} from './src/validate.js';

const [,,filePath] = process.argv;
const fullFilePath = path.resolve(filePath);

const logError = (error) => {
	assert.equal(typeof error.failures, 'function');
	const failures = error.failures();

	assert.equal(Array.isArray(failures), true);
	console.error(
		failures.map((failure) => {
			return `At ${failure.path.join('.')}: ${failure.message}`;
		}).join('\n'),
	);
};

console.debug(`Validating a definitions file at ${fullFilePath}`);

// [err, validatedObject]
const [err] = validateFromFile(fullFilePath);
if (err) {
	logError(err);
	process.exit(1);
} else {
	console.log('OK');
}
