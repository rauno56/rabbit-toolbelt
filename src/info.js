const printInfo = (definitions) => {
	console.log('Total nr of:');
	console.log('- vhosts:', definitions.vhosts.length);
	console.log('- exchanges:', definitions.exchanges.length);
	console.log('- queues:', definitions.queues.length);
	console.log('- users:', definitions.users.length);
	console.log('- permissions:', definitions.permissions.length);
	console.log('- topic permissions:', definitions.topic_permissions.length);
};

export default printInfo;
