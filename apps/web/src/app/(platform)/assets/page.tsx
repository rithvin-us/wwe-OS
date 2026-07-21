import { PageHeader } from "@bop/ui/components/page-header";
import { getDCs, getSites } from "@/lib/assets";
import { getItems } from "@/lib/inventory";
import { DCTable } from "./dc-table";
import { GenerateDCDialog } from "./generate-dc-dialog";

export default async function DeliveryChallansPage() {
  const [dcs, sites, inventoryItems] = await Promise.all([getDCs(), getSites(), getItems()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Delivery Challans"
        description="Generate, track, and download Delivery Challans for equipment moved to various sites."
        actions={<GenerateDCDialog sites={sites} inventoryItems={inventoryItems} />}
      />

      <DCTable dcs={dcs} />
    </div>
  );
}
