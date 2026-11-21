import Link from "next/link";
import { Suspense } from "react";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { ListQueuesCommand } from "@aws-sdk/client-sqs";
import { ListTopicsCommand } from "@aws-sdk/client-sns";
import { ListRolesCommand, ListUsersCommand } from "@aws-sdk/client-iam";
import { DescribeLogGroupsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { aws, EMULATOR_DIR, EMULATOR_ENDPOINT, errorMessage, REGION } from "@/lib/emulator";
import { checkHealth } from "@/lib/health";
import { serviceById } from "@/lib/services";
import { Container, ExternalIcon, Header, KeyValue, LinkButton, StatusIndicator, Code } from "@/components/ui";
import { ServiceIcon } from "@/components/service-icon";
import { RecentlyVisited } from "@/components/client/recently-visited";
import { Page } from "@/components/page";

export const metadata = { title: "Console Home" };

function Grip() {
  return (
    <svg viewBox="0 0 10 16" className="mr-2 inline h-4 w-2.5 text-muted" fill="currentColor" aria-hidden>
      {[3, 8, 13].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" />))}
    </svg>
  );
}

function Widget({ title, info, actions, children, footer }: { title: string; info?: boolean; actions?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Container
      className="flex h-full flex-col"
      header={
        <Header
          info={info}
          actions={
            <>
              {actions}
              <span className="px-1 text-lg leading-none text-ink">⋮</span>
            </>
          }
        >
          <Grip />
          {title}
        </Header>
      }
      footer={footer}
    >
      {children}
    </Container>
  );
}

async function count<T>(fn: () => Promise<T[] | undefined>): Promise<number | string> {
  try {
    return (await fn())?.length ?? 0;
  } catch (e) {
    return errorMessage(e).includes("not implemented") ? "n/a" : "error";
  }
}

async function ResourceSummary() {
  const c = await aws();
  const rows = await Promise.all([
    ["s3", "Buckets", count(async () => (await c.s3.send(new ListBucketsCommand({}))).Buckets)],
    ["dynamodb", "Tables", count(async () => (await c.dynamodb.send(new ListTablesCommand({}))).TableNames)],
    ["lambda", "Functions", count(async () => (await c.lambda.send(new ListFunctionsCommand({}))).Functions)],
    ["sqs", "Queues", count(async () => (await c.sqs.send(new ListQueuesCommand({}))).QueueUrls)],
    ["sns", "Topics", count(async () => (await c.sns.send(new ListTopicsCommand({}))).Topics)],
    ["iam", "Users", count(async () => (await c.iam.send(new ListUsersCommand({}))).Users)],
    ["iam", "Roles", count(async () => (await c.iam.send(new ListRolesCommand({}))).Roles)],
    ["cloudwatch", "Log groups", count(async () => (await c.logs.send(new DescribeLogGroupsCommand({}))).logGroups)],
  ].map(async ([id, label, p]) => ({ id: id as string, label: label as string, value: await (p as Promise<number | string>) })));
  return (
    <ul className="grid grid-cols-2 gap-x-6">
      {rows.map((r) => {
        const s = serviceById(r.id)!;
        return (
          <li key={r.label} className="flex items-center justify-between border-b border-line-soft py-2.5">
            <Link href={s.href} className="flex items-center gap-2">
              <ServiceIcon service={s} size={20} />
              <span className="underline-link">{r.label}</span>
            </Link>
            <span className="text-xl font-bold text-heading">{r.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

async function EmulatorHealth() {
  const health = await checkHealth();
  let account = "-";
  let arn = "-";
  if (health.ok) {
    try {
      const c = await aws();
      const id = await c.sts.send(new GetCallerIdentityCommand({}));
      account = id.Account ?? "-";
      arn = id.Arn ?? "-";
    } catch (e) {
      arn = errorMessage(e);
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">Status</p>
        <p className="text-xl">
          {health.ok ? <StatusIndicator type="success">Healthy</StatusIndicator> : <StatusIndicator type="error">Unreachable</StatusIndicator>}
        </p>
        {!health.ok && <p className="mt-1 text-sm break-words text-danger">{health.detail}</p>}
      </div>
      <div className="border-t border-line-soft pt-3">
        <p className="text-sm text-muted">Caller identity</p>
        <p className="text-xl font-bold text-heading">{account}</p>
        <p className="text-sm break-all text-muted">{arn}</p>
      </div>
      <div className="border-t border-line-soft pt-3">
        <p className="text-sm text-muted">Region</p>
        <p className="text-sm">{REGION}</p>
      </div>
    </div>
  );
}

function Loading() {
  return <p className="py-4 text-muted">Loading…</p>;
}

export default async function Home() {
  return (
    <main className="px-4 py-6 pb-16 md:px-10">
      <Page>
        <Header
          variant="h1"
          info
          actions={
            <>
              <LinkButton href="/settings">Emulator settings</LinkButton>
              <LinkButton href="/s3/buckets/create" variant="primary">
                + Create bucket
              </LinkButton>
            </>
          }
        >
          Console Home
        </Header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1.4fr_1.2fr]">
          <Widget title="Recently visited" info actions={<LinkButton href="/services">All services</LinkButton>}>
            <RecentlyVisited />
          </Widget>
          <Widget title="Resource summary">
            <Suspense fallback={<Loading />}>
              <ResourceSummary />
            </Suspense>
          </Widget>
          <Widget title="Emulator health" info footer={<Link href="/settings" className="underline-link">Go to emulator settings</Link>}>
            <Suspense fallback={<Loading />}>
              <EmulatorHealth />
            </Suspense>
          </Widget>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Widget title="Get started">
            <ul className="divide-y divide-line-soft">
              {[
                ["Store files in S3", "Create a bucket, upload objects and browse prefixes.", "/s3/buckets/create"],
                ["Create a DynamoDB table", "Define keys, then put and scan items.", "/dynamodb/tables/create"],
                ["Deploy a Lambda function", "Create a Node.js or Python function from a template and test it.", "/lambda/functions/create"],
                ["Send messages with SQS", "Create a queue, then send and poll for messages.", "/sqs/queues"],
              ].map(([t, d, href]) => (
                <li key={href} className="py-3">
                  <Link href={href} className="underline-link font-bold">
                    {t}
                  </Link>
                  <p className="text-sm text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </Widget>
          <Widget title="Connection">
            <KeyValue
              columns={1}
              items={[
                { label: "Endpoint", value: <Code>{EMULATOR_ENDPOINT}</Code> },
                { label: "Run files (CA and credentials)", value: <Code>{EMULATOR_DIR}</Code> },
                {
                  label: "Use the same emulator from your shell",
                  value: <Code>source ~/.aws/emulator/9297.env</Code>,
                },
                {
                  label: "Documentation",
                  value: (
                    <a className="text-accent hover:underline" href="https://docs.aws.amazon.com/emulator/latest/userguide/" target="_blank" rel="noreferrer">
                      AWS Emulator user guide
                      <ExternalIcon />
                    </a>
                  ),
                },
              ]}
            />
          </Widget>
        </div>
      </Page>
    </main>
  );
}
