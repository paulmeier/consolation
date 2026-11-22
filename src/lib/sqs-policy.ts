import { GetQueueAttributesCommand, GetQueueUrlCommand, SetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import type { Clients } from "./emulator";

/**
 * Add a statement to a queue's access policy that lets an AWS service send to it
 * from one source ARN, as the console does when you wire a queue up as a
 * destination. Without it, AWS (and the emulator) withholds the deliveries.
 */
export async function allowServiceToSendToQueue(sqs: Clients["sqs"], queueArn: string, service: string, sourceArn: string, sid: string) {
  const name = queueArn.split(":").pop()!;
  const url = (await sqs.send(new GetQueueUrlCommand({ QueueName: name }))).QueueUrl!;
  const cur = (await sqs.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ["Policy"] }))).Attributes?.Policy;
  const policy: { Version: string; Statement: { Sid?: string }[] } = cur ? JSON.parse(cur) : { Version: "2012-10-17", Statement: [] };
  if (policy.Statement.some((s) => s.Sid === sid)) return;
  policy.Statement.push({
    Sid: sid,
    Effect: "Allow",
    Principal: { Service: service },
    Action: "SQS:SendMessage",
    Resource: queueArn,
    Condition: { ArnLike: { "aws:SourceArn": sourceArn } },
  } as { Sid: string });
  await sqs.send(new SetQueueAttributesCommand({ QueueUrl: url, Attributes: { Policy: JSON.stringify(policy) } }));
}

/** Let an SNS topic deliver to a queue ("Subscribe to Amazon SNS topic"). */
export const allowTopicToSendToQueue = (sqs: Clients["sqs"], queueArn: string, topicArn: string) =>
  allowServiceToSendToQueue(sqs, queueArn, "sns.amazonaws.com", topicArn, `topic-subscription-${topicArn}`);

/** Let S3 event notifications from a bucket go to a queue (S3 checks this on save). */
export const allowS3ToSendToQueue = (sqs: Clients["sqs"], queueArn: string, bucket: string) =>
  allowServiceToSendToQueue(sqs, queueArn, "s3.amazonaws.com", `arn:aws:s3:::${bucket}`, `s3-notifications-${bucket}`);

/** Let an EventBridge rule deliver to a queue target. */
export const allowRuleToSendToQueue = (sqs: Clients["sqs"], queueArn: string, ruleArn: string) =>
  allowServiceToSendToQueue(sqs, queueArn, "events.amazonaws.com", ruleArn, `eventbridge-${ruleArn.split("/").pop()}`);
