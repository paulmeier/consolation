import { Page } from "@/components/page";
import { Header } from "@/components/ui";
import { ParameterForm } from "../../parameter-form";

export const metadata = { title: "Create parameter | Systems Manager" };

export default function CreateParameter() {
  return (
    <Page>
      <Header variant="h1" info>Create parameter</Header>
      <ParameterForm cancelHref="/ssm/parameters" />
    </Page>
  );
}
