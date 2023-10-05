import assert from 'assert/strict';

export class HashSet extends Map {
	hash = null;
	onAdd = null;

	constructor(hash, onAdd) {
		super();
		assert.equal(typeof hash, 'function');
		this.hash = hash;
		if (onAdd) {
			assert.equal(typeof onAdd, 'function');
			this.onAdd = onAdd;
		}
	}

	getByHash(hash) { return super.get(hash); }
	get(item) { return super.get(this.hash(item)); }
	has(item) { return !!super.get(this.hash(item)); }
	deleteByHash(hash) { return super.delete(hash); }
	delete(item) { return super.delete(this.hash(item)); }
	add(item) {
		if (this.onAdd) { this.onAdd(item); }
		return this.set(this.hash(item), item);
	}

	// @deprecated -- use .values() directly
	all() { return [...this.values()]; }
}
