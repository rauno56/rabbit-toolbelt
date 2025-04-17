import assert from 'node:assert/strict';
import { noop, returnEmptyString } from './utils.js';

export class HashSet extends Map {
	hash = returnEmptyString;
	onAdd = noop;

	constructor(hash, onAddOrElements) {
		super();
		assert.equal(typeof hash, 'function');
		this.hash = hash;
		if (onAddOrElements) {
			if (typeof onAddOrElements === 'function') {
				this.onAdd = onAddOrElements;
			} else {
				assert.equal(typeof onAddOrElements[Symbol.iterator], 'function');
				for (const item of onAddOrElements) {
					this.add(item);
				}
			}
		}
	}

	getByHash(hash) { return super.get(hash); }
	get(item) { return super.get(this.hash(item)); }
	has(item) { return !!super.get(this.hash(item)); }
	deleteByHash(hash) { return super.delete(hash); }
	delete(item) { return super.delete(this.hash(item)); }
	add(item) {
		this.onAdd(item);
		return this.set(this.hash(item), item);
	}

	// @deprecated -- use .values() directly
	all() { return [...this.values()]; }
}

export default HashSet;
