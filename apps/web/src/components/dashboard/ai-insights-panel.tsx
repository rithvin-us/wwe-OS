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
    <SectionCard title="AI insights" icon={Sparkles}>
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
