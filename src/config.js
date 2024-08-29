import { strict as assert } from 'node:assert';

const deprecatedPrefix = 'RABVAL_';

/**
 * @param {string} envVar
 * @returns {boolean}
 */
const isDeprecatedEnvVar = (envVar) => {
	assert(typeof envVar, 'string');
	return envVar.startsWith(deprecatedPrefix);
};

/**\
 * @param {string} stableVar
 * @returns {string}
 */
const getDeprecatedEnvVar = (stableVar) => {
	assert(typeof stableVar, 'string');
	return stableVar.replace(/^RTB_/, deprecatedPrefix);
};

const isInRange = (value, min, max) => {
	return min <= value && value <= max;
};

function getListFromEnv(envVar, sep = ',') {
	assert(typeof envVar, 'string');
	if (!process.env[envVar]) {
		// TODO: remove after deprecation period
		if (!isDeprecatedEnvVar(envVar)) {
			return getListFromEnv(getDeprecatedEnvVar(envVar), sep);
		}
		return [];
	}
	return process.env[envVar]
		.split(sep);
}

/**
 * @param {string} envVar
 * @param {number} defaultValue
 * @returns {number}
 */
function getFloatFromEnv(envVar, defaultValue) {
	// TODO: remove after deprecation period
	if (!isDeprecatedEnvVar(envVar)) {
		return getFloatFromEnv(getDeprecatedEnvVar(envVar), defaultValue);
	}
	return parseFloat(process.env[envVar]) || defaultValue;
}

/**
 * @param {string} envVar
 * @param {number} defaultValue
 * @returns {number}
 */
function getIntFromEnv(envVar, defaultValue) {
	// TODO: remove after deprecation period
	if (!isDeprecatedEnvVar(envVar)) {
		return getIntFromEnv(getDeprecatedEnvVar(envVar), defaultValue);
	}
	return parseInt(process.env[envVar]) || defaultValue;
}

/**
 * @param {string} envVar
 * @param {RegExp | null} defaultValue
 * @returns {RegExp | null}
 */
function getRegexpFromEnv(envVar, defaultValue = null) {
	const value = process.env[envVar];
	if (!value) {
		// TODO: remove after deprecation period
		if (!isDeprecatedEnvVar(envVar)) {
			return getRegexpFromEnv(getDeprecatedEnvVar(envVar), defaultValue);
		}
		return defaultValue;
	}
	return new RegExp(value);
}

const defaultPattern = getRegexpFromEnv('RTB_PATTERN');
const defaultAllowList = getListFromEnv('RTB_STRING_ALLOW', ',');

const C = {
	requestDelay: getIntFromEnv('RTB_REQUEST_DELAY', 9),
	unusedFailureThreshold: {
		vhost: getFloatFromEnv('RTB_UNUSED_FAIL_THRESHOLD_VHOST', 0.3),
		exchange: getFloatFromEnv('RTB_UNUSED_FAIL_THRESHOLD_EXCHANGE', 0.3),
		queue: getFloatFromEnv('RTB_UNUSED_FAIL_THRESHOLD_QUEUE', 0.3),
	},
	pattern: {
		vhosts: getRegexpFromEnv('RTB_PATTERN_VHOSTS', defaultPattern),
		users: getRegexpFromEnv('RTB_PATTERN_USERS', defaultPattern),
		policies: getRegexpFromEnv('RTB_PATTERN_POLICIES', defaultPattern),
		queues: getRegexpFromEnv('RTB_PATTERN_QUEUES', defaultPattern),
		exchanges: getRegexpFromEnv('RTB_PATTERN_EXCHANGES', defaultPattern),
	},
	normalStringAllowList: defaultAllowList,
	nameAllowList: {
		vhosts: defaultAllowList.concat(getListFromEnv('RTB_PATTERN_ALLOW_VHOSTS', ',')),
		users: defaultAllowList.concat(getListFromEnv('RTB_PATTERN_ALLOW_USERS', ',')),
		queues: defaultAllowList.concat(getListFromEnv('RTB_PATTERN_ALLOW_QUEUES', ',')),
		exchanges: defaultAllowList.concat(getListFromEnv('RTB_PATTERN_ALLOW_EXCHANGES', ',')),
	},
};

assert(isInRange(C.unusedFailureThreshold.vhost, 0, 1), 'Unused failure ratio out of bounds [0, 1]');
assert(isInRange(C.unusedFailureThreshold.exchange, 0, 1), 'Unused failure ratio out of bounds [0, 1]');
assert(isInRange(C.unusedFailureThreshold.queue, 0, 1), 'Unused failure ratio out of bounds [0, 1]');

export default C;
