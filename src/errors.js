
export class IndexingError extends Error {
	resource;
	type;
	originalMessage;

	constructor(type, resource, sourcePath, err) {
		super(sourcePath ? `failed to index ${type} @ ${sourcePath}: ${err.message}` : `failed to index ${type}: ${err.message}`);
		this.resource = resource;
		this.type = type;
		this.originalMessage = err.message;
	}

	static from(type, resource, sourcePath, err) {
		return new IndexingError(type, resource, sourcePath, err);
	}
}
