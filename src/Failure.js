import assert from 'node:assert/strict';

export default class Failure {
	message = null;
	path = null;
	explanation = null;
	value = null;
	key = null;

	static arrayFromSuperstructError(error) {
		if (error === undefined) {
			return [];
		}
		assert.equal(typeof error.failures, 'function', `Not a Superstruct error: ${error}`);
		const failures = error.failures();
		return failures.map(Failure.fromSuperstructFailure);
	}

	static fromSuperstructFailure({ message, value, key, path, explanation }) {
		return new Failure({ message, value, key, path, explanation });
	}

	constructor({ message, value, key, path, explanation }) {
		this.message = message;
		this.value = value;
		this.key = key;
		this.path = path;
		this.explanation = explanation;
	}
}
