# RabbitMQ toolbelt

RabbitMQ toolbelt for managing, validating and deploying `definitions.json`.

## Commands

### Validate

**Subcommand**: `validate`<br>
**Example**: `rabbit-toolbelt validate ./definitions.json ./usage.json`

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

- `RTB_STRING_ALLOW`: a comma-separated list of names to allow through the name validation regardless of their value. Example: `invalid but passable,??test-dont-delete??`.
- `RTB_UNUSED_FAIL_THRESHOLD_VHOST`: Threshold(float) for unused **vhost** ratio for failing the run. Example: `0.3`.
- `RTB_UNUSED_FAIL_THRESHOLD_EXCHANGE`: Threshold(float) for unused **exchange** ratio for failing the run. Example: `0.3`.
- `RTB_UNUSED_FAIL_THRESHOLD_QUEUE`: Threshold(float) for unused **queue** ratio for failing the run. Example: `0.3`.

### Resource-aware diffing

**Subcommand**: `diff`<br>
**Example**: `rabbit-toolbelt diff http://user:password@rabbitmq.dev.acme.com/ ./local.definitions.json`

Makes it easy to compare a local definitions file to a server or even two different servers.
Both arguments can either be a path to a local file or url to a management API with credentials.

#### Relevant cli flags

- `--ignore-file`: Path to ignore file.
- `--json`: Output JSON to make parsing the result with another programm easier.
- `--limit`: Limit the number of changes to show for each type.

### Deployments

**Subcommand**: `deploy`<br>
**Example**: `rabbit-toolbelt deploy ./local.definitions.json http://user:password@rabbitmq.dev.acme.com/`

Connects to a management API and deploys the state in provided definitions file. Protocol is always required and has to be http or https.

#### Relevant cli flags

- `--dry-run`: Run as configured but make all non-GET network calls no-op.
- `--ignore-file`: Path to ignore file.
- `--no-deletions`: Never delete any resources.
- `--recreate-changed`: Since resources are immutable in RabbitMQ, changing properties requires deletion and recreation. By default changes are not deployed, but this option turns it on. Use with caution because it will affect channels actively using those resources.

## Additional comments

### Ignore files

`--ignore-file` can be used to pass an ignore list `diff` and `deploy` operations. Ignore file should look something like this:

```
# Comments are allowed
/vhosts/my-vhost-to-ignore
/users/user-to-ignore
/queues/%2f/queue-to-ignore
/exchanges/%2f/exchange-to-ignore
```

The rules reflect the management API paths for resources they specify the ingore rule for. All rules start with `/` which is followed by the type. Possible rules:

- `/vhosts/{name}` - ignore a vhost,
- `/users/{name}` - ignore an user,
- `/queues/{vhost.name}/{name}` - ignore a queue,
- `/exchanges/{vhost.name}/{name}` - ignore an exchange.

Root vhost must be uri-encoded(to `%2f`). All other specifies are also uri-decoded.

**All related resources to already ignored resources are also ignored.** That naturally means that ignoring a vhost also ignores all exchanges in that vhost, ignoring an exchange also ignores all bindings to and from that exchange, etc.

## Installing

#### Quick run

```bash
# Install from npm and run
npx rabbit-toolbelt validate <path/definitions.json> [<path/usage.json>]
```

#### Run from npm

```bash
npm i rabbit-toolbelt # install locally

npx rabbit-toolbelt validate <path/definitions.json> [<path/usage.json>]
# or to force npx offline:
npx --offline rabbit-toolbelt validate <path/definitions.json> [<path/usage.json>]

# --offline is not required if previously installed, but errors if
# it isn't instead of downloading the package
```

#### Install globally from npm and run

```bash
npm i --global rabbit-toolbelt # install with "--global" flag puts it to path

rabbit-toolbelt validate <path/definitions.json> [<path/usage.json>]
```

#### Run from the repo

```bash
git clone git@github.com:rauno56/rabbit-toolbelt.git
cd rabbit-toolbelt
npx . validate <path/definitions.json> [<path/usage.json>]
# or
node cli.js validate <path/definitions.json> [<path/usage.json>]
```
