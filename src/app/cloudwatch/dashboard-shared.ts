export const STARTER_DASHBOARD = JSON.stringify(
  {
    widgets: [
      { type: "text", x: 0, y: 0, width: 24, height: 2, properties: { markdown: "# My dashboard\nEdit the dashboard JSON to add widgets." } },
      { type: "metric", x: 0, y: 2, width: 12, height: 6, properties: { title: "Requests", region: "us-east-1", stat: "Sum", period: 60, metrics: [["Consolation/Demo", "RequestCount", "Service", "web"]] } },
    ],
  },
  null,
  2,
);
