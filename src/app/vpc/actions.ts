"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AcceptVpcPeeringConnectionCommand,
  AllocateAddressCommand,
  AssociateRouteTableCommand,
  AttachInternetGatewayCommand,
  CreateInternetGatewayCommand,
  CreateNatGatewayCommand,
  CreateRouteCommand,
  CreateRouteTableCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  CreateVpcEndpointCommand,
  CreateVpcPeeringConnectionCommand,
  DeleteInternetGatewayCommand,
  DeleteNatGatewayCommand,
  DeleteRouteCommand,
  DeleteRouteTableCommand,
  DeleteSubnetCommand,
  DeleteVpcCommand,
  DeleteVpcEndpointsCommand,
  DeleteVpcPeeringConnectionCommand,
  DescribeInternetGatewaysCommand,
  DetachInternetGatewayCommand,
  DisassociateRouteTableCommand,
  ModifyVpcAttributeCommand,
  ReleaseAddressCommand,
  type ResourceType,
} from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

async function guard(ok: string, paths: string[], fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  paths.forEach((p) => revalidatePath(p));
}

const tags = (type: ResourceType, name: string) => (name ? [{ ResourceType: type, Tags: [{ Key: "Name", Value: name }] }] : undefined);
const sel = (fd: FormData) => fd.getAll("selected").map(String);

export async function createVpc(fd: FormData) {
  let id = "";
  try {
    const { ec2 } = await aws();
    const r = await ec2.send(new CreateVpcCommand({ CidrBlock: String(fd.get("cidr")), InstanceTenancy: "default", TagSpecifications: tags("vpc", String(fd.get("name") ?? "").trim()) }));
    id = r.Vpc!.VpcId!;
    if (fd.get("dnsHostnames") === "on") await ec2.send(new ModifyVpcAttributeCommand({ VpcId: id, EnableDnsHostnames: { Value: true } }));
    if (fd.get("withIgw") === "on") {
      const igw = (await ec2.send(new CreateInternetGatewayCommand({ TagSpecifications: tags("internet-gateway", `${String(fd.get("name") || id)}-igw`) }))).InternetGateway!.InternetGatewayId!;
      await ec2.send(new AttachInternetGatewayCommand({ InternetGatewayId: igw, VpcId: id }));
    }
  } catch (e) {
    await flash("error", `Failed to create VPC. ${errorMessage(e)}`);
    revalidatePath("/vpc/vpcs");
    return;
  }
  await flash("success", `You successfully created ${id}.`);
  redirect(`/vpc/vpcs/${id}`);
}

export async function deleteVpcs(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of sel(fd)) {
    await guard(`Deleted ${id}.`, ["/vpc/vpcs"], async () => {
      // Detach and delete internet gateways first, as the console's delete flow does.
      const igws = (await ec2.send(new DescribeInternetGatewaysCommand({ Filters: [{ Name: "attachment.vpc-id", Values: [id] }] }))).InternetGateways ?? [];
      for (const g of igws) {
        await ec2.send(new DetachInternetGatewayCommand({ InternetGatewayId: g.InternetGatewayId, VpcId: id }));
        await ec2.send(new DeleteInternetGatewayCommand({ InternetGatewayId: g.InternetGatewayId }));
      }
      await ec2.send(new DeleteVpcCommand({ VpcId: id }));
    });
  }
  if (fd.get("from") === "detail") redirect("/vpc/vpcs");
}

export async function createSubnet(fd: FormData) {
  const { ec2 } = await aws();
  await guard("Subnet created.", ["/vpc/subnets", `/vpc/vpcs/${fd.get("vpc")}`], () =>
    ec2.send(
      new CreateSubnetCommand({
        VpcId: String(fd.get("vpc")),
        CidrBlock: String(fd.get("cidr")),
        ...(String(fd.get("az") ?? "") ? { AvailabilityZone: String(fd.get("az")) } : {}),
        TagSpecifications: tags("subnet", String(fd.get("name") ?? "").trim()),
      }),
    ),
  );
}

export async function deleteSubnets(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of sel(fd)) await guard(`Deleted ${id}.`, ["/vpc/subnets"], () => ec2.send(new DeleteSubnetCommand({ SubnetId: id })));
}

export async function createRouteTable(fd: FormData) {
  const { ec2 } = await aws();
  await guard("Route table created.", ["/vpc/route-tables"], () => ec2.send(new CreateRouteTableCommand({ VpcId: String(fd.get("vpc")), TagSpecifications: tags("route-table", String(fd.get("name") ?? "").trim()) })));
}

export async function deleteRouteTables(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of sel(fd)) await guard(`Deleted ${id}.`, ["/vpc/route-tables"], () => ec2.send(new DeleteRouteTableCommand({ RouteTableId: id })));
}

export async function addRoute(fd: FormData) {
  const rt = String(fd.get("rt"));
  const target = String(fd.get("target"));
  const { ec2 } = await aws();
  await guard("Route added.", [`/vpc/route-tables/${rt}`], () =>
    ec2.send(
      new CreateRouteCommand({
        RouteTableId: rt,
        DestinationCidrBlock: String(fd.get("destination")),
        ...(target.startsWith("igw-") ? { GatewayId: target } : target.startsWith("nat-") ? { NatGatewayId: target } : target.startsWith("pcx-") ? { VpcPeeringConnectionId: target } : { GatewayId: target }),
      }),
    ),
  );
}

export async function deleteRoutes(fd: FormData) {
  const rt = String(fd.get("rt"));
  const { ec2 } = await aws();
  for (const d of sel(fd)) await guard(`Route ${d} deleted.`, [`/vpc/route-tables/${rt}`], () => ec2.send(new DeleteRouteCommand({ RouteTableId: rt, DestinationCidrBlock: d })));
}

export async function associateSubnet(fd: FormData) {
  const rt = String(fd.get("rt"));
  const { ec2 } = await aws();
  await guard("Subnet associated.", [`/vpc/route-tables/${rt}`], () => ec2.send(new AssociateRouteTableCommand({ RouteTableId: rt, SubnetId: String(fd.get("subnet")) })));
}

export async function disassociate(fd: FormData) {
  const rt = String(fd.get("rt"));
  const { ec2 } = await aws();
  for (const a of sel(fd)) await guard("Subnet disassociated.", [`/vpc/route-tables/${rt}`], () => ec2.send(new DisassociateRouteTableCommand({ AssociationId: a })));
}

export async function createIgw(fd: FormData) {
  const { ec2 } = await aws();
  await guard("Internet gateway created.", ["/vpc/internet-gateways"], () => ec2.send(new CreateInternetGatewayCommand({ TagSpecifications: tags("internet-gateway", String(fd.get("name") ?? "").trim()) })));
}

export async function attachIgw(fd: FormData) {
  const { ec2 } = await aws();
  const vpc = String(fd.get("vpc"));
  for (const id of sel(fd)) await guard(`Attached ${id} to ${vpc}.`, ["/vpc/internet-gateways"], () => ec2.send(new AttachInternetGatewayCommand({ InternetGatewayId: id, VpcId: vpc })));
}

export async function detachIgw(fd: FormData) {
  const { ec2 } = await aws();
  for (const v of sel(fd)) {
    const [id, vpc] = v.split("|");
    await guard(`Detached ${id}.`, ["/vpc/internet-gateways"], () => (vpc ? ec2.send(new DetachInternetGatewayCommand({ InternetGatewayId: id, VpcId: vpc })) : Promise.reject(new Error(`${id} is not attached.`))));
  }
}

export async function deleteIgws(fd: FormData) {
  const { ec2 } = await aws();
  for (const v of sel(fd)) {
    const id = v.split("|")[0];
    await guard(`Deleted ${id}.`, ["/vpc/internet-gateways"], () => ec2.send(new DeleteInternetGatewayCommand({ InternetGatewayId: id })));
  }
}

export async function allocateEip(fd: FormData) {
  const { ec2 } = await aws();
  await guard("Elastic IP address allocated.", ["/vpc/elastic-ips"], () => ec2.send(new AllocateAddressCommand({ Domain: "vpc", TagSpecifications: tags("elastic-ip", String(fd.get("name") ?? "").trim()) })));
}

export async function releaseEips(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of sel(fd)) await guard(`Released ${id}.`, ["/vpc/elastic-ips"], () => ec2.send(new ReleaseAddressCommand({ AllocationId: id })));
}

export async function createNat(fd: FormData) {
  const { ec2 } = await aws();
  await guard("NAT gateway created.", ["/vpc/nat-gateways"], async () => {
    const pub = fd.get("connectivity") !== "private";
    let alloc = String(fd.get("eip") ?? "");
    if (pub && !alloc) alloc = (await ec2.send(new AllocateAddressCommand({ Domain: "vpc" }))).AllocationId!;
    await ec2.send(
      new CreateNatGatewayCommand({
        SubnetId: String(fd.get("subnet")),
        ConnectivityType: pub ? "public" : "private",
        ...(pub ? { AllocationId: alloc } : {}),
        TagSpecifications: tags("natgateway", String(fd.get("name") ?? "").trim()),
      }),
    );
  });
}

export async function deleteNats(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of sel(fd)) await guard(`Deleting ${id}.`, ["/vpc/nat-gateways"], () => ec2.send(new DeleteNatGatewayCommand({ NatGatewayId: id })));
}

export async function createEndpoint(fd: FormData) {
  const { ec2 } = await aws();
  const type = String(fd.get("type") ?? "Gateway");
  await guard("Endpoint created.", ["/vpc/endpoints"], () =>
    ec2.send(
      new CreateVpcEndpointCommand({
        VpcId: String(fd.get("vpc")),
        ServiceName: String(fd.get("service")),
        VpcEndpointType: type as "Gateway" | "Interface",
        ...(type === "Gateway" ? { RouteTableIds: fd.getAll("routeTables").map(String) } : { SubnetIds: fd.getAll("subnets").map(String) }),
        TagSpecifications: tags("vpc-endpoint", String(fd.get("name") ?? "").trim()),
      }),
    ),
  );
}

export async function deleteEndpoints(fd: FormData) {
  const { ec2 } = await aws();
  const ids = sel(fd);
  await guard(`Deleted ${ids.length} endpoint${ids.length === 1 ? "" : "s"}.`, ["/vpc/endpoints"], () => ec2.send(new DeleteVpcEndpointsCommand({ VpcEndpointIds: ids })));
}

export async function createPeering(fd: FormData) {
  const { ec2 } = await aws();
  await guard("Peering connection requested.", ["/vpc/peering"], () =>
    ec2.send(new CreateVpcPeeringConnectionCommand({ VpcId: String(fd.get("requester")), PeerVpcId: String(fd.get("accepter")), TagSpecifications: tags("vpc-peering-connection", String(fd.get("name") ?? "").trim()) })),
  );
}

export async function acceptPeering(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of sel(fd)) await guard(`Accepted ${id}.`, ["/vpc/peering"], () => ec2.send(new AcceptVpcPeeringConnectionCommand({ VpcPeeringConnectionId: id })));
}

export async function deletePeering(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of sel(fd)) await guard(`Deleted ${id}.`, ["/vpc/peering"], () => ec2.send(new DeleteVpcPeeringConnectionCommand({ VpcPeeringConnectionId: id })));
}
