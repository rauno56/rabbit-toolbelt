const printInfo = (definitions) => {
	console.log('Total nr of:');
	console.log('- vhosts:', definitions.vhosts?.length ?? 0);
	console.log('- exchanges:', definitions.exchanges?.length ?? 0);
	console.log('- queues:', definitions.queues?.length ?? 0);
	console.log('- users:', definitions.users?.length ?? 0);
	console.log('- permissions:', definitions.permissions?.length ?? 0);
	console.log('- topic permissions:', definitions.topic_permissions?.length ?? 0);
};

export default printInfo;
