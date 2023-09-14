import diff from './diff.js';
import { key } from './Index.js';

export const indexPropertiesKeyMap = (bindings) => {
	return new Map(bindings.map((item) => {
		return [key.binding(item), item.properties_key];
	}));
};

export const diffServer = async (client, definitions) => {
	const [
		bindings,
		current,
	] = await Promise.all([
		client.requestBindings(),
		client.requestDefinitions(),
	]);
	const propertiesKeyMap = indexPropertiesKeyMap(bindings);
	const changes = diff(current, definitions);

	for (const b of changes['deleted']['bindings']) {
		const bKey = key.binding(b);
		const properties_key = propertiesKeyMap.get(bKey);
		if (properties_key) {
			b.properties_key = properties_key;
		} else {
			console.warn('Cannot find properties_key for binding', b);
		}
	}

	return changes;
};
