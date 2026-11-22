import type { Tag } from "@aws-sdk/client-ec2";
import { StatusIndicator } from "@/components/ui";
import { TagsPanel } from "@/components/tags";
import { removeTags, setTags } from "./actions";

export const nameTag = (tags?: Tag[]) => tags?.find((t) => t.Key === "Name")?.Value;

export function ResourceState({ state }: { state?: string }) {
  const s = state ?? "";
  if (["running", "available", "in-use", "completed", "active", "attached", "associated", "fulfilled"].includes(s)) return <StatusIndicator type="success">{s}</StatusIndicator>;
  if (["pending", "stopping", "shutting-down", "creating", "attaching", "detaching", "deleting", "open"].includes(s)) return <StatusIndicator type="pending">{s}</StatusIndicator>;
  if (["stopped", "deleted", "deregistered", "cancelled", "closed", "released"].includes(s)) return <StatusIndicator type="stopped">{s}</StatusIndicator>;
  if (["terminated", "error", "failed"].includes(s)) return <StatusIndicator type="error">{s}</StatusIndicator>;
  return <>{s || "-"}</>;
}

/** Tags container for any EC2 resource (CreateTags/DeleteTags). */
export function Ec2Tags({ id, tags, path }: { id: string; tags?: Tag[]; path: string }) {
  return <TagsPanel tags={tags ?? []} addAction={setTags} removeAction={removeTags} hidden={{ resource: id, path }} />;
}

export const INSTANCE_TYPES = ["t2.nano", "t2.micro", "t2.small", "t2.medium", "t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large", "m5.xlarge", "c5.large", "r5.large"];
