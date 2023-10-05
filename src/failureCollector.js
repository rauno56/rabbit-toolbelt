import * as nodeAssert from 'node:assert/strict';
import Failure from './Failure.js';

export default (throwOnFirstError = true) => {
	const failures = new Map();
	const assert = {
		collectFailures: () => {
			return [...failures.values()];
		},
	};
	const defineAssert = (method) => {
		if (throwOnFirstError) {
			return assert[method] = nodeAssert[method];
		}
		return assert[method] = (...args) => {
			try {
				nodeAssert[method](...args);
				return true;
			} catch (err) {
				// deduplicating all the "duplicate X" failures
				const failure = new Failure({ message: err.message, stack: err.stack });
				failures.set(failure.message, failure);
				return false;
			}
		};
	};
	defineAssert('ok');
	defineAssert('fail');
	defineAssert('equal');

	return assert;
};
