import { StatusIndicator } from "@/components/ui";

export const smPath = (arn: string) => `/stepfunctions/state-machines/${encodeURIComponent(arn)}`;
export const execPath = (arn: string) => `/stepfunctions/executions/${encodeURIComponent(arn)}`;

export function execStatus(s?: string) {
  switch (s) {
    case "SUCCEEDED":
      return <StatusIndicator type="success">Succeeded</StatusIndicator>;
    case "RUNNING":
    case "PENDING_REDRIVE":
      return <StatusIndicator type="pending">{s === "RUNNING" ? "Running" : "Pending redrive"}</StatusIndicator>;
    case "FAILED":
    case "TIMED_OUT":
      return <StatusIndicator type="error">{s === "FAILED" ? "Failed" : "Timed out"}</StatusIndicator>;
    case "ABORTED":
      return <StatusIndicator type="stopped">Aborted</StatusIndicator>;
    default:
      return s ?? "-";
  }
}

export const HELLO_WORLD = JSON.stringify(
  {
    Comment: "A Hello World example using a Pass and a Choice state",
    StartAt: "Pass",
    States: {
      Pass: { Type: "Pass", Result: { greeting: "Hello" }, ResultPath: "$.result", Next: "Is it a greeting?" },
      "Is it a greeting?": {
        Type: "Choice",
        Choices: [{ Variable: "$.result.greeting", StringEquals: "Hello", Next: "Wait" }],
        Default: "Fail",
      },
      Wait: { Type: "Wait", Seconds: 1, Next: "Success" },
      Success: { Type: "Succeed" },
      Fail: { Type: "Fail", Error: "NotAGreeting", Cause: "The result was not Hello" },
    },
  },
  null,
  2,
);
