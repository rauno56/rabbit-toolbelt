const printInfo = (definitions) => {
	console.log('Total nr of vhosts:', definitions.vhosts.length);
	console.log('Total nr of exchanges:', definitions.exchanges.length);
	console.log('Total nr of queues:', definitions.queues.length);
	console.log('Total nr of users:', definitions.users.length);
};

export default printInfo;
