# RabbitMQ definitions.json file validator

Script to do basic validation on `definitions.json` file for RabbitMQ for GitOps:

- validates the shape of the json,
- asserts all the names only to contain ASCII printable characters: `a-z0-9:_./\-*#`,
- when second path argument is provided, also checks usage against a fixed list.

## `usage.json`

`usage.json` should contain json array of following objects:

- `{ vhost: string, queue: string }` if the entry represents interacting with queue directly or
- `{ vhost: string, exchange: string, queue: string }` if the entry represents interacting with queue through an exchange.

Such statistics can be fetch from Prometheus API for example.

## Usage

#### Quick run

```bash
# Install from npm and run
npx rabbit-validator <path/definitions.json> [<path/usage.json>]
```

#### Run from npm

```bash
npm i rabbit-validator # install locally

npx rabbit-validator <path/definitions.json> [<path/usage.json>]
# or to force npx offline:
npx --offline rabbit-validator <path/definitions.json> [<path/usage.json>]

# --offline is not required if previously installed, but errors if
# it isn't instead of downloading the package
```

#### Install globally from npm and run

```bash
npm i --global rabbit-validator # install with "--global" flag puts it to path

rabbit-validator <path/definitions.json> [<path/usage.json>]
```

#### Run from the repo

```bash
git clone git@github.com:rauno56/rabbit-validator.git
cd rabbit-validator
npx . <path/definitions.json> [<path/usage.json>]
```

## Configuration

The utility is configured via environment variables:

- `RABVAL_STRING_ALLOW`: a comma-separated list of names to allow through the name validation regardless of their value.
