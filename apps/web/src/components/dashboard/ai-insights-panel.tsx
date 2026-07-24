import { Sparkles } from "@bop/icons";

import { PanelEmpty, SectionCard } from "@/components/dashboard/section-card";
import { buildAiInsights } from "@/config/dashboard";

/**
 * Awaits the AI business summary on its own — isolated in a `<Suspense>`
 * boundary by the caller so a cold cache never blocks the rest of the
 * dashboard's first paint.
 */
export async function AiInsightsPanel({
  summaryPromise,
}: {
  summaryPromise: Promise<string | null>;
}) {
  const summary = await summaryPromise;
  const insights = buildAiInsights(summary);

  return (
    <SectionCard
      title="AI insights"
      icon={Sparkles}
      // This section can genuinely resolve well after the rest of the page
      // (isolated behind its own Suspense boundary in the dashboard so a
      // cold AI cache never blocks first paint) — the fade confirms this
      // specific arrival rather than decorating a mount that already
      // happened moments ago.
      className="animate-in fade-in duration-(--duration-base) ease-out-quart"
    >
      {insights.length === 0 ? (
        <PanelEmpty>
          Once there&rsquo;s activity to learn from, you&rsquo;ll see trends and suggestions here.
        </PanelEmpty>
      ) : (
        <ul className="space-y-3">
          {insights.map((item) => (
            <li key={item.id} className="text-sm text-foreground">
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
