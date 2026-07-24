import { PageHeader } from "@bop/ui/components/page-header";
import { getDCs, getSites } from "@/lib/assets";
import { DCTable } from "./dc-table";
import { GenerateDCDialog } from "./generate-dc-dialog";
import { DCAnalytics } from "./dc-analytics";

export default async function DeliveryChallansPage() {
  const [dcs, sites] = await Promise.all([getDCs(), getSites()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Challans"
        description="Generate, track, and download Delivery Challans for equipment moved to various sites."
        actions={<GenerateDCDialog sites={sites} />}
      />

      <DCAnalytics dcs={dcs} />

      <DCTable dcs={dcs} />
    </div>
  );
}
