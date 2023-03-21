#!/usr/bin/env node

import path from 'node:path';
import { strict as assert } from 'assert';
import validate from './src/validate.js';

const [,,filePath] = process.argv;
const fullFilePath = path.resolve(filePath);

const logFailures = (failures) => {
	assert.equal(Array.isArray(failures), true, `Invalid list of failures: ${failures}`);
	console.error(
		failures.map((failure) => {
			if (failure.path) {
				return `At ${failure.path.join('.')}: ${failure.message}`;
			}
			return failure.message;
		}).join('\n'),
	);
};

console.debug(`Validating a definitions file at ${fullFilePath}`);

// Failure[]
const failures = validate(fullFilePath);
if (failures.length) {
	logFailures(failures);
	process.exit(1);
} else {
	console.log('OK');
}
