module.exports = {
	'env': {
		'es2021': true,
		'node': true,
	},
	'extends': 'eslint:recommended',
	'parserOptions': {
		'ecmaVersion': 'latest',
		'sourceType': 'module',
	},
	'rules': {
		'indent': [
			'error',
			'tab',
		],
		'linebreak-style': [
			'error',
			'unix',
		],
		'quotes': [
			'error',
			'single',
		],
		'semi': [
			'error',
			'always',
		],
		'no-trailing-spaces': [
			'error',
		],
		'comma-dangle': ['error', {
			'arrays': 'always-multiline',
			'objects': 'always-multiline',
			'imports': 'always-multiline',
			'exports': 'always-multiline',
			'functions': 'always-multiline',
		}],
	},
};
