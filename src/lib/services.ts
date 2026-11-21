export type Category =
  | "Compute"
  | "Storage"
  | "Database"
  | "Application Integration"
  | "Security, Identity, & Compliance"
  | "Management & Governance"
  | "Networking & Content Delivery";

export type Service = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: Category;
  href: string;
  /** Has working pages in Consolation; others show a placeholder. */
  implemented: boolean;
  abbr: string;
};

export const CATEGORY_COLORS: Record<Category, string> = {
  Compute: "from-[#c8511b] to-[#ff9900]",
  Storage: "from-[#3f8624] to-[#7aa116]",
  Database: "from-[#2e27ad] to-[#527fff]",
  "Application Integration": "from-[#b0084d] to-[#ff4f8b]",
  "Security, Identity, & Compliance": "from-[#bd0816] to-[#ff5252]",
  "Management & Governance": "from-[#b0084d] to-[#ff4f8b]",
  "Networking & Content Delivery": "from-[#4d27a8] to-[#a166ff]",
};

export const SERVICES: Service[] = [
  { id: "s3", name: "Amazon S3", shortName: "S3", abbr: "S3", description: "Scalable storage in the cloud", category: "Storage", href: "/s3/buckets", implemented: true },
  { id: "dynamodb", name: "Amazon DynamoDB", shortName: "DynamoDB", abbr: "DDB", description: "Managed NoSQL database", category: "Database", href: "/dynamodb/tables", implemented: true },
  { id: "lambda", name: "AWS Lambda", shortName: "Lambda", abbr: "λ", description: "Run code without thinking about servers", category: "Compute", href: "/lambda/functions", implemented: true },
  { id: "sqs", name: "Amazon Simple Queue Service", shortName: "Simple Queue Service", abbr: "SQS", description: "Managed message queues", category: "Application Integration", href: "/sqs/queues", implemented: true },
  { id: "sns", name: "Amazon Simple Notification Service", shortName: "Simple Notification Service", abbr: "SNS", description: "Pub/sub, SMS, email, and mobile push notifications", category: "Application Integration", href: "/sns/topics", implemented: true },
  { id: "iam", name: "AWS Identity and Access Management", shortName: "IAM", abbr: "IAM", description: "Manage access to AWS resources", category: "Security, Identity, & Compliance", href: "/iam/users", implemented: true },
  { id: "cloudwatch", name: "Amazon CloudWatch", shortName: "CloudWatch", abbr: "CW", description: "Monitor resources and applications", category: "Management & Governance", href: "/cloudwatch/log-groups", implemented: true },
  { id: "ec2", name: "Amazon EC2", shortName: "EC2", abbr: "EC2", description: "Virtual servers in the cloud", category: "Compute", href: "/ec2/instances", implemented: true },
  { id: "ssm", name: "AWS Systems Manager", shortName: "Systems Manager", abbr: "SSM", description: "Parameter Store and operational management", category: "Management & Governance", href: "/ssm/parameters", implemented: true },
  { id: "ecr", name: "Amazon Elastic Container Registry", shortName: "Elastic Container Registry", abbr: "ECR", description: "Fully managed container registry", category: "Compute", href: "/ecr/repositories", implemented: true },
  { id: "cloudformation", name: "AWS CloudFormation", shortName: "CloudFormation", abbr: "CFN", description: "Create and manage resources with templates", category: "Management & Governance", href: "/service/cloudformation", implemented: false },
  { id: "stepfunctions", name: "AWS Step Functions", shortName: "Step Functions", abbr: "SFN", description: "Coordinate distributed applications", category: "Application Integration", href: "/stepfunctions/state-machines", implemented: true },
  { id: "secretsmanager", name: "AWS Secrets Manager", shortName: "Secrets Manager", abbr: "SM", description: "Easily rotate, manage, and retrieve secrets", category: "Security, Identity, & Compliance", href: "/secretsmanager/secrets", implemented: true },
  { id: "kms", name: "AWS Key Management Service", shortName: "Key Management Service", abbr: "KMS", description: "Securely generate and manage encryption keys", category: "Security, Identity, & Compliance", href: "/kms/keys", implemented: true },
  { id: "route53", name: "Amazon Route 53", shortName: "Route 53", abbr: "R53", description: "Scalable DNS and domain name registration", category: "Networking & Content Delivery", href: "/route53/hosted-zones", implemented: true },
  { id: "vpc", name: "Amazon VPC", shortName: "VPC", abbr: "VPC", description: "Isolated cloud resources", category: "Networking & Content Delivery", href: "/service/vpc", implemented: false },
  { id: "eventbridge", name: "Amazon EventBridge", shortName: "EventBridge", abbr: "EB", description: "Serverless event bus", category: "Application Integration", href: "/eventbridge/rules", implemented: true },
  { id: "kinesis", name: "Amazon Kinesis", shortName: "Kinesis", abbr: "KDS", description: "Work with real-time streaming data", category: "Application Integration", href: "/kinesis/streams", implemented: true },
];

export function serviceById(id: string) {
  return SERVICES.find((s) => s.id === id);
}

export const CATEGORIES = Array.from(new Set(SERVICES.map((s) => s.category)));
