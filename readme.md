# RabbitMQ definitions.json file validator

Script to do basic validation on `definitions.json` file for RabbitMQ for GitOps:

- validates the shape of the json,
- asserts all the names only to contain "normal" printable characters: `a-z0-9:_./\-*#`.

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

#### Install globally from npm and run

```bash
npm i --global rabbit-validator # install with "--global" flag puts it to path

rabbit-validator [path/to/definitions.json]
```

#### Run from the repo

```bash
git clone git@github.com:Rauno56/rabbit-validator.git
cd rabbit-validator
npx . [path/to/definitions.json]
```

## Configuration

The utility is configured via environment variables:

- `RABVAL_STRING_ALLOW`: a comma-separated list of names to allow through the name validation regardless of their value.
