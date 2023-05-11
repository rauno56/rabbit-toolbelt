import * as nodeAssert from 'node:assert/strict';
import Failure from './Failure.js';

export default (throwOnFirstError = false) => {
	const failures = new Map();
	const assert = {
		collectFailures: () => {
			return [...failures.values()];
		},
	};
	const defineAssert = (method) => {
		if (throwOnFirstError) {
			assert[method] = nodeAssert[method];
		}
		return assert[method] = (...args) => {
			try {
				return nodeAssert[method](...args);
			} catch (err) {
				// deduplicating all the "duplicate X" failures
				const failure = new Failure({ message: err.message });
				failures.set(failure.message, failure);
			}
		};
	};
	defineAssert('ok');
	defineAssert('fail');
	defineAssert('equal');

	return assert;
};
