# RabbitMQ toolbelt

RabbitMQ toolbelt for managing, validating and deploying your `definitions.json`.

## Commands

### Validate

**Subcommand**: `validate`<br>
**Example**: `rabbit-validator validate ./definitions.json ./usage.json`

Runs series of validations on RabbitMQ's definitions file for GitOps:

- validates the shape of the json,
- warns about redundant options,
- asserts all the names only to contain ASCII printable characters: `a-z0-9:_./\-*#`,
- when second path argument is provided, also checks usage against a fixed list of know-to-be-used resources,
- asserts that there are no missing resources: queue assigned to a vhost but no vhost defined, binding's source and destination existance, etc,
- checks for binding duplication, and more.

#### `usage.json`

`usage.json` should contain json array of following objects:

- `{ vhost: string, queue: string }` if the entry represents interacting with queue directly or
- `{ vhost: string, exchange: string, queue: string }` if the entry represents interacting with queue through an exchange.

Such statistics can be fetch from Prometheus API for example.

#### Relevant environment variables

- `RABVAL_STRING_ALLOW`: a comma-separated list of names to allow through the name validation regardless of their value. Example: `invalid but passable,??test-dont-delete??`.
- `RABVAL_UNUSED_FAIL_THRESHOLD_VHOST`: Threshold(float) for unused **vhost** ratio for failing the run. Example: `0.3`.
- `RABVAL_UNUSED_FAIL_THRESHOLD_EXCHANGE`: Threshold(float) for unused **exchange** ratio for failing the run. Example: `0.3`.
- `RABVAL_UNUSED_FAIL_THRESHOLD_QUEUE`: Threshold(float) for unused **queue** ratio for failing the run. Example: `0.3`.

### Resource-aware diffing

**Subcommand**: `diff`<br>
**Example**: `rabbit-validator diff http://user:password@rabbitmq.dev.acme.com/ ./local.definitions.json`

Makes it easy to compare a local definitions file to a server or even two different servers.
Both arguments can either be a path to a local file or url to a management API with credentials.

#### Relevant cli flags

- `--json`: Output JSON to make parsing the result with another programm easier

### Deployments

**Subcommand**: `deploy`<br>
**Example**: `rabbit-validator deploy ./local.definitions.json http://user:password@rabbitmq.dev.acme.com/`

Connects to a management API and deploys the state in provided definitions file. Protocol is always required and has to be http or https.

#### Relevant cli flags

- `--no-deletions`: Never delete any resources.
- `--recreate-changed`: Since resources are immutable in RabbitMQ, changing properties requires deletion and recreation. By default changes are not deployed, but this option turns it on. Use with caution because it will affect channels actively using those resources.

## Installing

#### Quick run

```bash
# Install from npm and run
npx rabbit-validator validate <path/definitions.json> [<path/usage.json>]
```

#### Run from npm

```bash
npm i rabbit-validator # install locally

npx rabbit-validator validate <path/definitions.json> [<path/usage.json>]
# or to force npx offline:
npx --offline rabbit-validator validate <path/definitions.json> [<path/usage.json>]

# --offline is not required if previously installed, but errors if
# it isn't instead of downloading the package
```

#### Install globally from npm and run

```bash
npm i --global rabbit-validator # install with "--global" flag puts it to path

rabbit-validator validate <path/definitions.json> [<path/usage.json>]
```

#### Run from the repo

```bash
git clone git@github.com:rauno56/rabbit-validator.git
cd rabbit-validator
npx . validate <path/definitions.json> [<path/usage.json>]
# or
node cli.js validate <path/definitions.json> [<path/usage.json>]
```
