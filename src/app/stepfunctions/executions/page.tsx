import { redirect } from "next/navigation";

/** Breadcrumb target: executions are listed per state machine. */
export default function Executions() {
  redirect("/stepfunctions/state-machines");
}
