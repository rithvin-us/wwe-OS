import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { Send, FileText } from "@bop/icons";

export const metadata: Metadata = {
  title: "Purchases",
};

export default function PurchasePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchases"
        description="Request, approve, and track purchases across the company."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-5 text-muted-foreground" />
              Telegram Bot Integration
            </CardTitle>
            <CardDescription>Upload purchase bills directly from Telegram.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Once the Telegram bot is configured and running, you can send purchase bills to the
              bot. The system will automatically extract the seller name, date, and rate using OCR
              and link it here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-muted-foreground" />
              Recent Bills
            </CardTitle>
            <CardDescription>Waiting for incoming documents.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No bills have been uploaded yet. Send a bill via Telegram to see it appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
