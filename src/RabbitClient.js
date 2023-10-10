import * as assert from 'node:assert/strict';

import { parseUrl } from './utils.js';

class RequestError extends Error {
	constructor(status, text, context) {
		super(text);
		this.status = status;
		this.context = context;
	}
}

const tryParse = (body) => {
	try {
		return JSON.parse(body);
	} catch {
		return body;
	}
};

const request = (url, user, password, method, body) => {
	return fetch(url, {
		method,
		headers: {
			'Authorization': 'Basic ' + Buffer.from(user + ':' + password).toString('base64'),
			'content-type': 'application/json',
		},
		...(body && { body: JSON.stringify(body) }),
	}).then(async (res) => {
		if (res.status >= 300) {
			throw new RequestError(res.status, res.statusText, {
				response: tryParse(await res.text()),
				url,
				method,
				body,
			});
		}
		const text = await res.text();
		return text || 'OK:' + res.status;
	});
};

class RabbitClient {
	baseUrl;
	dryRun;
	#username;
	#password;

	constructor(url, { dryRun = false } = {}) {
		assert.ok(url instanceof URL, `Expected URL object, got ${url}`);
		assert.ok(['http:', 'https:'].includes(url.protocol), `Expected url protocol to be http or https, got ${url.protocol}`);

		const {
			username,
			password,
			baseUrl,
		} = parseUrl(url);

		this.baseUrl = baseUrl;
		this.dryRun = dryRun;
		this.#username = decodeURIComponent(username);
		this.#password = decodeURIComponent(password);
	}

	request(method, path, body) {
		// only do GET requests if dry run is requested
		if (this.dryRun && method !== 'GET') {
			return Promise.resolve({
				url: new URL(path, this.baseUrl).toString(),
				method,
				body,
			});
		}
		return request(new URL(path, this.baseUrl).toString(), this.#username, this.#password, method, body);
	}

	async requestBindings() {
		return JSON.parse(await this.request('GET', '/api/bindings'));
	}

	async requestDefinitions() {
		return JSON.parse(await this.request('GET', '/api/definitions'));
	}
}

export default RabbitClient;
