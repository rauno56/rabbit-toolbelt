#!/usr/bin/env node

import path from 'node:path';
import { strict as assert } from 'assert';
import validate from './src/validate.js';

const [,, filePath, usageFilePath] = process.argv;

if (!filePath) {
	console.error('usage: rabbit-validator <path/definitions.json> [<path/usage.json>]');
	console.error('       usage.json is a fail containing array of objects { vhost, exchange, queue } | { vhost, queue } of used RabbitMQ resources.');
	process.exit(1);
}

const fullFilePath = path.resolve(filePath);
const fullUsageFilePath = usageFilePath && path.resolve(usageFilePath);

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
	if (failures.length) {
		console.error('Total nr of failures:', failures.length);
	}
};

console.debug(`Validating a definitions file at ${fullFilePath}${fullUsageFilePath ? ' with usage stats from ' + fullUsageFilePath : ''}`);

// Failure[]
const failures = validate(fullFilePath, fullUsageFilePath);
if (failures.length) {
	logFailures(failures);
	process.exit(1);
} else {
	console.log('OK');
}
