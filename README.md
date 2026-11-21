# Consolation

A local web console for [AWS Emulator](https://docs.aws.amazon.com/emulator/latest/userguide/), built with Next.js (App Router) and Tailwind CSS. Its layout and design tokens follow the AWS Management Console: top bar with service search (`Option+S`), a services menu, collapsible side navigation, breadcrumbs, Cloudscape-style tables, modals and flash notifications. Every page reads and writes live emulator state.

## Services

| Service | What works |
| --- | --- |
| Console Home | Recently visited, resource counts, emulator health and caller identity |
| S3 | Buckets: list, create (optional versioning), empty, delete. Objects: browse prefixes, create folders, upload, preview, download, delete |
| DynamoDB | Tables: list, create (partition + sort key), delete, overview. Items: scan, create/replace from JSON, delete |
| Lambda | Functions: list, create from a Node.js/Python template (auto-creates an execution role), edit and deploy code, test invoke with logs, configuration (memory, timeout, env vars), delete |
| SQS | Queues: list with message counts, create standard/FIFO, purge, delete. Send, poll and delete messages |
| SNS | Topics: list, create standard/FIFO, delete. Subscriptions: create, delete. Publish messages |
| IAM | Users (access keys, attached policies), roles (trust policy, attached policies), customer managed policies |
| CloudWatch Logs | Log groups, log streams, view and put log events |
| EC2 | Instances: launch, start, stop, reboot, terminate. Security groups and key pairs |

Other entries in the services menu (CloudFormation, Step Functions, KMS, …) open a placeholder page.

## Run it

1. Start AWS Emulator in Docker so that it writes its run files to `~/.aws/emulator/9297/` (`ca.pem`, `emulator_credentials`, `config`) and publishes port 9297 on `127.0.0.1`.
2. Install and start Consolation:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://127.0.0.1:3000.

`npm run build && npm start` runs a production build. Both servers bind to `127.0.0.1` only.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `EMULATOR_PORT` | `9297` | Emulator port |
| `EMULATOR_ENDPOINT` | `https://127.0.0.1:$EMULATOR_PORT` | Emulator endpoint |
| `EMULATOR_DIR` | `~/.aws/emulator/$EMULATOR_PORT` | Folder with this run's `ca.pem` and `emulator_credentials` |
| `EMULATOR_REGION` | `us-east-1` | Region used for requests |
| `CONSOLATION_ALLOW_NON_LOOPBACK` | unset | Set to `1` to allow a non-loopback endpoint |

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
