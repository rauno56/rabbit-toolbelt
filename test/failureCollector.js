import { strict as assert } from 'assert';
import { describe, it } from 'node:test';

import failureCollector from '../src/failureCollector.js';

describe('failureCollector', () => {
	it('has API', () => {
		const collector = failureCollector();

		assert.equal(typeof collector.collectFailures, 'function');
		assert.equal(typeof collector.fail, 'function');
		assert.equal(typeof collector.ok, 'function');
	});

	it('throws by default', () => {
		const collector = failureCollector();

		assert.throws(() => {
			collector.fail('Error in tests');
		});
	});

	it('throws if throwOnFirstError = true', () => {
		const collector = failureCollector(true);

		assert.throws(() => {
			collector.fail('Error in tests');
		});
	});

	it('returns an array of failures throwOnFirstError = false', () => {
		const collector = failureCollector(false);

		const message = 'Error in tests';
		collector.fail(message);

		const failures = collector.collectFailures();

		assert.ok(Array.isArray(failures));
		assert.equal(failures.length, 1);
		assert.equal(failures[0].message, message);
	});
});
