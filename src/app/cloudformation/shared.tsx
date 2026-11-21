import { Alert, StatusIndicator } from "@/components/ui";

export function stackStatus(s?: string) {
  if (!s) return "-";
  const label = s.replace(/_/g, " ");
  if (s.endsWith("_COMPLETE") && !s.includes("ROLLBACK") && !s.startsWith("DELETE")) return <StatusIndicator type="success">{label}</StatusIndicator>;
  if (s.endsWith("_IN_PROGRESS")) return <StatusIndicator type="pending">{label}</StatusIndicator>;
  if (s.endsWith("_FAILED") || s.includes("ROLLBACK")) return <StatusIndicator type="error">{label}</StatusIndicator>;
  if (s.startsWith("DELETE")) return <StatusIndicator type="stopped">{label}</StatusIndicator>;
  return label;
}

/** Map a stack resource to its page in Consolation, when one exists. */
export function resourceHref(type?: string, physicalId?: string): string | null {
  if (!type || !physicalId) return null;
  const id = encodeURIComponent(physicalId);
  switch (type) {
    case "AWS::S3::Bucket":
      return `/s3/buckets/${id}`;
    case "AWS::DynamoDB::Table":
      return `/dynamodb/tables/${id}`;
    case "AWS::Lambda::Function":
      return `/lambda/functions/${id}`;
    case "AWS::SQS::Queue":
      return `/sqs/queues/${encodeURIComponent(physicalId.split("/").pop()!)}`;
    case "AWS::SNS::Topic":
      return `/sns/topics/${id}`;
    case "AWS::IAM::Role":
      return `/iam/roles/${id}`;
    case "AWS::IAM::User":
      return `/iam/users/${id}`;
    case "AWS::Logs::LogGroup":
      return `/cloudwatch/log-groups/${id}`;
    case "AWS::SecretsManager::Secret":
      return `/secretsmanager/secrets/${encodeURIComponent(physicalId.split(":").pop()!.replace(/-[A-Za-z0-9]{6}$/, ""))}`;
    case "AWS::SSM::Parameter":
      return `/ssm/parameters/view?name=${id}`;
    case "AWS::KMS::Key":
      return `/kms/keys/${id}`;
    case "AWS::StepFunctions::StateMachine":
      return `/stepfunctions/state-machines/${id}`;
    case "AWS::Kinesis::Stream":
      return `/kinesis/streams/${id}`;
    case "AWS::ECR::Repository":
      return `/ecr/repositories/${id}`;
    case "AWS::EC2::VPC":
      return `/vpc/vpcs/${id}`;
    case "AWS::EC2::RouteTable":
      return `/vpc/route-tables/${id}`;
    default:
      return null;
  }
}

export function CoverageBanner() {
  return (
    <Alert type="warning">
      CloudFormation has low coverage in the emulator (about 29% of scored tests pass in v1.0.556). Simple stacks of supported resources work; others may fail or behave differently than on AWS.
    </Alert>
  );
}

export const SAMPLE_TEMPLATE = JSON.stringify(
  {
    AWSTemplateFormatVersion: "2010-09-09",
    Description: "Sample stack: a queue, a topic subscribed to it, and a parameter",
    Parameters: { Env: { Type: "String", Default: "dev", AllowedValues: ["dev", "prod"] } },
    Resources: {
      Queue: { Type: "AWS::SQS::Queue", Properties: { QueueName: { "Fn::Sub": "${AWS::StackName}-${Env}-queue" } } },
      Topic: { Type: "AWS::SNS::Topic" },
      Subscription: { Type: "AWS::SNS::Subscription", Properties: { Protocol: "sqs", TopicArn: { Ref: "Topic" }, Endpoint: { "Fn::GetAtt": ["Queue", "Arn"] } } },
      Setting: { Type: "AWS::SSM::Parameter", Properties: { Name: { "Fn::Sub": "/${AWS::StackName}/env" }, Type: "String", Value: { Ref: "Env" } } },
    },
    Outputs: {
      QueueUrl: { Value: { Ref: "Queue" }, Export: { Name: { "Fn::Sub": "${AWS::StackName}-QueueUrl" } } },
      TopicArn: { Value: { Ref: "Topic" } },
    },
  },
  null,
  2,
);
