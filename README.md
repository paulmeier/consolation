# Consolation

A local web console for [AWS Emulator](https://docs.aws.amazon.com/emulator/latest/userguide/), built with Next.js (App Router) and Tailwind CSS. Its layout and design tokens follow the AWS Management Console: top bar with service search (`Option+S`), a services menu, collapsible side navigation, breadcrumbs, Cloudscape-style tables, modals and flash notifications. Every page reads and writes live emulator state.

## Services

| Service | What works |
| --- | --- |
| Console Home | Recently visited, resource counts, emulator health and caller identity |
| S3 | Buckets: create, empty, delete. Objects: prefixes, folders, streamed multipart upload with progress, preview, download, versions, copy/move, tags, presigned URLs, pagination. Properties (versioning, tags, encryption, website), permissions (Block Public Access, policy, CORS), lifecycle rules |
| DynamoDB | Tables with GSIs and deletion protection; Explore items with Scan or Query (indexes, sort-key conditions, pagination) and in-place editing; PartiQL editor; indexes; TTL, point-in-time recovery, tags; backups and restore; streams with a record viewer |
| Lambda | Functions from templates or .zip, code editor, test invoke with saved events, monitor (recent logs), configuration (env vars, layers, concurrency, async destinations, function URL, resource policy), versions and weighted aliases, triggers (SQS, Kinesis, DynamoDB streams) with automatic role permissions, layers |
| SQS | Queues: list with message counts, create standard/FIFO, purge, delete. Send, poll and delete messages |
| SNS | Topics: list, create standard/FIFO, delete. Subscriptions: create, delete. Publish messages |
| IAM | Users (access keys, attached policies), roles (trust policy, attached policies), customer managed policies |
| CloudWatch Logs | Log groups, log streams, view and put log events |
| EC2 | Instances: launch, start, stop, reboot, terminate. Security groups and key pairs |
| CloudWatch metrics | Metrics browser with an SVG chart, publish test data, alarms (create, history, set state, actions), dashboards (text and metric widgets, JSON source) |
| Secrets Manager | Store secrets (key/value or plaintext), reveal on demand, edit value (versions and staging labels), resource policy, rotation config, scheduled deletion and restore, tags |
| Systems Manager Parameter Store | String/StringList/SecureString parameters, masked values with decrypt on demand, history and labels, path browsing, tags |
| KMS | Customer and AWS managed keys, create symmetric/asymmetric/HMAC keys, enable/disable, rotation, aliases, key policy, scheduled deletion, cryptography playground (encrypt, decrypt, data keys, sign/verify, MAC) |
| Step Functions | State machines with an ASL editor and live graph, executions with input/output, event history and graph highlighting, stop and redrive, activities |
| EventBridge | Event buses, rules (pattern or schedule, targets, enable/disable, pattern tester), send events, archives and replays, connections and API destinations |
| Kinesis Data Streams | Streams (on-demand/provisioned), data viewer (put and read records per shard), split/merge shards, enhanced fan-out consumers, retention and scaling |
| ECR | Private repositories, images and scan findings, lifecycle and repository policies, tag mutability and scan-on-push settings |
| Route 53 | Hosted zones (public/private), record editor (simple, alias, weighted), health checks |
| VPC | VPCs with a resource map, subnets, route tables (routes and associations), internet and NAT gateways, Elastic IPs, endpoints, peering, network ACLs |
| CloudFormation | Stacks from pasted or uploaded templates, events, resources (linked to their Consolation pages), outputs, exports, change sets, update, drift detection. The emulator's coverage is low, so the pages show a warning |
| API Gateway | REST APIs (resource tree, mock/Lambda/HTTP methods, test-invoke, deploy, authorizers), HTTP and WebSocket APIs (routes, integrations, stages), a real call through a stage's invoke URL, API keys and usage plans |
| Cognito | User pools (users, enable/disable, groups, app clients, domain) and identity pools |
| ECS | Clusters, services (desired count), tasks (run/stop), task definitions (form or JSON) |
| RDS | Instances and Aurora clusters (create with a Secrets Manager–managed password, stop/start/reboot/delete), snapshots, subnet and parameter groups |

Other entries in the services menu (CloudFormation, VPC, …) open a placeholder page. Every table supports filtering, sorting by column, pagination and a preferences modal (page size, visible columns, wrap lines, striped rows) saved per table.

## Run it

1. Start AWS Emulator in Docker so that it writes its run files to `~/.aws/emulator/9297/` (`ca.pem`, `emulator_credentials`, `config`) and publishes port 9297 on `127.0.0.1`.
2. Install and start Consolation:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://127.0.0.1:3000.

`npm run build && npm start` runs a production build. Both servers bind to `127.0.0.1` only.

## Tests and CI

```bash
npm run lint
npm run typecheck
npm run test:e2e                                   # builds and starts the app on 127.0.0.1:3100
E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e  # reuse a running dev server
```

The Playwright suite in `e2e/` needs a running emulator. It creates uniquely named resources and deletes them again.

`.github/workflows/ci.yml` runs lint, type-check and build, then builds the emulator image from `docker/aws-emulator/Dockerfile` (latest package, no version pin), starts it on 127.0.0.1 with telemetry off, and runs the end-to-end suite.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `EMULATOR_PORT` | `9297` | Emulator port |
| `EMULATOR_ENDPOINT` | `https://127.0.0.1:$EMULATOR_PORT` | Emulator endpoint |
| `EMULATOR_DIR` | `~/.aws/emulator/$EMULATOR_PORT` | Folder with this run's `ca.pem` and `emulator_credentials` |
| `EMULATOR_REGION` | `us-east-1` | Region used for requests |
| `CONSOLATION_ALLOW_NON_LOOPBACK` | unset | Set to `1` to allow a non-loopback endpoint |

## Emulator notes

- Some emulator responses carry epoch timestamps with nanosecond precision, which the AWS SDK for JavaScript rejects. `src/lib/emulator.ts` trims them to milliseconds before deserialization.
- API Gateway stages are called through the emulator with the `<api-id>.execute-api.<region>.amazonaws.com` Host header. Lambda function URLs are served on an internal emulator port, which is not reachable when the emulator runs in Docker with only port 9297 published.
- EventBridge (v1.0.556) accepted events but did not deliver them to an SQS target in testing.

## How it connects

- `src/lib/emulator.ts` builds AWS SDK v3 clients for each request. They sign with the credentials the emulator wrote for the current run and verify TLS against that run's `ca.pem`. Both files are re-read per request, so restarting the emulator needs no restart of Consolation. TLS verification is never turned off.
- Only loopback endpoints are accepted, so Consolation cannot send requests to real AWS. Real AWS credentials in the environment are ignored.
- Reads are React Server Components streamed inside `<Suspense>`. Writes are Server Actions that revalidate the page and set a one-time flash message.
- Table selection uses plain HTML (`<input form="…">` plus CSS `:has()`), so header actions such as Delete or Purge work without client state. Destructive actions ask for a typed confirmation.
- Emulator state lives in memory and is lost when the emulator stops.

## Layout

```
src/
  app/                    one folder per service (layout.tsx = side nav, actions.ts = Server Actions)
  components/ui.tsx       Cloudscape-style primitives (Button, Container, Header, KeyValue, StatusIndicator, …)
  components/table.tsx    selectable table bound to an external form
  components/client/      top nav, service shell, modals, confirm dialogs, table filter, flashbar
  lib/emulator.ts         emulator connection, loopback guard, error formatting
  lib/services.ts         service catalog used by search, menus and Console Home
```
