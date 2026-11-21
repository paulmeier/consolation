export const RUNTIMES = [
  { id: "nodejs22.x", label: "Node.js 22.x", handler: "index.handler", file: "index.mjs" },
  { id: "nodejs20.x", label: "Node.js 20.x", handler: "index.handler", file: "index.mjs" },
  { id: "python3.13", label: "Python 3.13", handler: "lambda_function.lambda_handler", file: "lambda_function.py" },
  { id: "python3.12", label: "Python 3.12", handler: "lambda_function.lambda_handler", file: "lambda_function.py" },
] as const;

export function runtimeInfo(id?: string) {
  return RUNTIMES.find((r) => r.id === id) ?? (id?.startsWith("python") ? RUNTIMES[2] : RUNTIMES[0]);
}

export function templateFor(runtime: string) {
  return runtime.startsWith("python")
    ? `import json

def lambda_handler(event, context):
    # TODO implement
    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }
`
    : `export const handler = async (event) => {
  // TODO implement
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};
`;
}
