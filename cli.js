#!/usr/bin/env node

import { strict as assert } from 'node:assert';
import path from 'node:path';
import { inspect } from 'node:util';

import validate from './src/validate.js';
import diff from './src/diff.js';
import deploy from './src/deploy.js';
import { getOpt, readJSONSync } from './src/utils.js';
import { resolveDefinitions } from './src/resolveDefinitions.js';

const opts = {
	json: getOpt('--json'),
	h: getOpt('-h'),
	help: getOpt('--help'),
	summary: getOpt('--summary'),
};

const [,, subcommand, ...args] = process.argv;

if (
	!subcommand
	|| opts.h
	|| opts.help
) {
	console.error('usage: rabbit-validator <COMMAND> <OPTIONS>');
	console.error('Commands:');
	console.error('\tvalidate <path/definitions.json> [<path/usage.json>] # Validates definition file');
	console.error('\t         usage.json is a fail containing array of objects { vhost, exchange, queue } | { vhost, queue } of used RabbitMQ resources.');
	console.error();
	console.error('\tdiff <path/definitions.before.json> <path/definitions.after.json>');
	console.error('\t         Diffs two definition files or servers.');
	console.error('\t         Either or both of the arguments can also be paths to a management API: https://username:password@live.rabbit.acme.com');
	console.error();
	console.error('\tdeploy <base url for a management API> <path/definitions.to.deploy.json>');
	console.error('\t         Connects to a management API and deploys the state in provided definitions file.');
	console.error('\t         Base url is root url for the management API: http://username:password@dev.rabbitmq.com');
	console.error('\t         Protocol is required to be http or https.');
	process.exit(1);
}

const commands = {
	validate: (filePath, usageFilePath) => {
		const fullFilePath = path.resolve(filePath);
		const fullUsageFilePath = usageFilePath && path.resolve(usageFilePath);

		const logFailures = (failures) => {
			assert.equal(Array.isArray(failures), true, `Invalid list of failures: ${failures}`);
			console.error('Failures:');
			console.error(
				failures.map((failure) => {
					if (failure.path) {
						return `At ${failure.path.join('.')}: ${failure.message}`;
					}
					return failure.message;
				}).map((f, idx) => {
					return `${idx + 1}. ${f}`;
				}).join('\n'),
			);
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
	},
	diff: async (beforeInput, afterInput) => {
		assert.equal(typeof beforeInput, 'string', 'Path or url to before definitions required');
		assert.equal(typeof afterInput, 'string', 'Path or url to after definitions required');

		const [before, after] = await Promise.all([
			resolveDefinitions(beforeInput),
			resolveDefinitions(afterInput),
		]);

		const result = diff(before, after);

		if (opts.json) {
			return console.log(JSON.stringify(result));
		}

		inspect.defaultOptions.depth += 2;
		console.log(
			Object.fromEntries(
				Object.entries(result)
					.reduce((acc, [op, resources]) => {
						const shaken = Object.entries(resources)
							.filter(([, changes]) => changes.length)
							.map(([key, changes]) => {
								if (opts.summary) {
									return [key, changes.length];
								}
								return [key, changes];
							});
						if (shaken.length) {
							acc.push([op, Object.fromEntries(shaken)]);
						}
						return acc;
					}, [])
			)
		);
	},
	deploy: (serverBaseUrl, definitions) => {
		return deploy(new URL(serverBaseUrl), readJSONSync(definitions));
	},
};

if (typeof commands[subcommand] === 'function') {
	await commands[subcommand](...args);
} else {
	console.error('Running rabbit-validator without subcommand is deprecated');
	commands.validate(subcommand, args[0]);
}
