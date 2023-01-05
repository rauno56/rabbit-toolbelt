# RabbitMQ definitions.json file validator

Script to do basic validation on `definitions.json` file for RabbitMQ for GitOps.

## Usage

#### Quick run

```bash
# Install from npm and run
npx rabbit-validator [path/to/definitions.json]
```

#### Run from npm

```bash
npm i rabbit-validator # install locally

npx rabbit-validator [path/to/definitions.json]
# or to force npx offline:
npx --offline rabbit-validator [path/to/definitions.json]

# --offline is not required if previously installed, but errors if
# it isn't instead of downloading the package
```

#### Run from the repo

```bash
git clone git@github.com:Rauno56/rabbit-validator.git
cd rabbit-validator
npx . [path/to/definitions.json]
```
