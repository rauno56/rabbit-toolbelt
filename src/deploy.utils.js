import diff from './diff.js';
import { key } from './Index.js';

export const indexPropertiesKeyMap = (bindings) => {
	return new Map(bindings.map((item) => {
		return [key.bindings(item), item.properties_key];
	}));
};

export const diffServer = async (client, definitions) => {
	const [
		bindings,
		current,
	] = await Promise.all([
		// Must request bindings separately because properties_key is
		// not included in standard definitions file. Later merge
		// with the definitions file to be able to deploy changes.
		client.requestBindings(),
		client.requestDefinitions(),
	]);
	const propertiesKeyMap = indexPropertiesKeyMap(bindings);
	const changes = diff(current, definitions);

	for (const b of changes['deleted']['bindings']) {
		const bKey = key.bindings(b);
		const properties_key = propertiesKeyMap.get(bKey);
		if (properties_key) {
			b.properties_key = properties_key;
		} else {
			console.warn('Cannot find properties_key for binding', b);
		}
	}

	return changes;
};
