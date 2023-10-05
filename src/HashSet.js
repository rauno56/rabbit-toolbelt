import assert from 'assert/strict';

export class HashSet extends Map {
	hash = () => '';

	constructor(hash) {
		super();
		assert.equal(typeof hash, 'function');
		this.hash = hash;
	}

	getByHash(hash) { return super.get(hash); }
	get(item) { return super.get(this.hash(item)); }
	has(item) { return !!super.get(this.hash(item)); }
	deleteByHash(hash) { return super.delete(hash); }
	delete(item) { return super.delete(this.hash(item)); }
	add(item) { return this.set(this.hash(item), item); }

	// @deprecated -- use size instead
	count() { return this.size; }
	// @deprecated -- use .values() directly
	all() { return [...this.values()]; }
}
