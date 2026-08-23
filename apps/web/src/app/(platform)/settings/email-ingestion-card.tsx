"use client";

import { useState, useEffect } from "react";
import { Mail, CheckCircle2, Copy, Send, Plus, Trash2, ShieldAlert, Sparkles } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

const STORAGE_KEY = "wwe_email_ingestion_settings";

export interface EmailIngestionSettings {
  enabled: boolean;
  allowedSenders: string[];
  autoClassifyBills: boolean;
}

export function EmailIngestionCard() {
  const [copied, setCopied] = useState(false);
  const [newSender, setNewSender] = useState("");
  const [testing, setTesting] = useState(false);

  const [settings, setSettings] = useState<EmailIngestionSettings>({
    enabled: true,
    allowedSenders: [
      "clients@cognizant.com",
      "accounting@vendor.com",
      "@waterworksengineering.com",
    ],
    autoClassifyBills: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unavailable during render and on the server
        setSettings(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveSettings = (updated: EmailIngestionSettings) => {
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    toast.success("Email Ingestion rules updated.");
  };

  const handleAddSender = () => {
    const trimmed = newSender.trim().toLowerCase();
    if (!trimmed) return;
    if (settings.allowedSenders.includes(trimmed)) {
      toast.error("Email ID or domain already in the list.");
      return;
    }
    const updated = {
      ...settings,
      allowedSenders: [...settings.allowedSenders, trimmed],
    };
    saveSettings(updated);
    setNewSender("");
  };

  const handleRemoveSender = (senderToRemove: string) => {
    const updated = {
      ...settings,
      allowedSenders: settings.allowedSenders.filter((s) => s !== senderToRemove),
    };
    saveSettings(updated);
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/ingest/email`
      : "/api/ingest/email";

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestIngest = async () => {
    setTesting(true);
    try {
      // Simulate sending an incoming email with an attached PDF document
      const samplePdfBase64 =
        "JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwvTGVuZ3RoIDQ2Pj5zdHJlYW0KQlQKL0YxIDEyIFRmCjcwIDczMCBUZCAoV1dFIE9TIFRlc3QgRG9jdW1lbnQgQXR0YWNobWVudCkgVGoKRUQKZW5kc3RyZWFtCmVuZG9iaiB0cmFpbGVyCjw8L1Jvb3QgMSAwIFI+PgolJUVPRgo=";

      const testSender = settings.allowedSenders[0] || "clients@cognizant.com";

      const res = await fetch("/api/ingest/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: testSender,
          subject: "PO Contract & Specification Document 2026",
          body: "Please find attached the official purchase order contract document.",
          attachments: [
            {
              filename: "Cognizant_PO_Contract_2026.pdf",
              content_type: "application/pdf",
              content_b64: samplePdfBase64,
            },
          ],
        }),
      });

      const data = await res.json().catch(() => null);
      setTesting(false);

      if (res.ok && data?.success) {
        toast.success(`Email Webhook Test Passed! Attachment saved to Document Management (DMS).`);
      } else {
        toast.error(data?.message || "Email Webhook test failed.");
      }
    } catch {
      setTesting(false);
      toast.error("Network error testing email webhook.");
    }
  };

  return (
    <Card className="border border-blue-500/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="size-5 text-blue-500" />
          Email Ingestion & VIP Sender Rules
        </CardTitle>
        <CardDescription>
          Configure important email addresses. When an email with document attachments arrives from
          these senders, the attachments are automatically downloaded and saved to{" "}
          <strong>Document Management (DMS)</strong> with AI summaries.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Toggle Enable */}
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              Auto-Ingest Attachments to Documents
            </p>
            <p className="text-[11px] text-muted-foreground">
              Automatically extract and save PDFs/images from allowed senders directly into DMS.
            </p>
          </div>
          <button
            type="button"
            onClick={() => saveSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-(--duration-base) ease-in-out focus:outline-none ${
              settings.enabled ? "bg-blue-500" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-(--duration-base) ease-in-out ${
                settings.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Important Sender Emails Input */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold">Important Sender Email IDs / Domains</Label>
          <p className="text-[11px] text-muted-foreground">
            Emails received from these exact email addresses or wildcard domains (e.g.{" "}
            <code>@company.com</code>) will have their documents auto-saved.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="e.g. billing@vendor.com or @clients.com"
              value={newSender}
              onChange={(e) => setNewSender(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSender()}
              className="h-9 text-xs"
            />
            <Button size="sm" onClick={handleAddSender} className="gap-1 text-xs shrink-0">
              <Plus className="size-3.5" /> Add Email ID
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {settings.allowedSenders.map((sender) => (
              <span
                key={sender}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-mono font-medium text-blue-600 dark:text-blue-400"
              >
                <span>{sender}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSender(sender)}
                  className="hover:text-destructive transition-colors cursor-pointer"
                  title="Remove sender"
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Live Webhook Integration URL */}
        <div className="space-y-2 pt-4 border-t border-border">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Inbound Email Webhook URL
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Configure this endpoint in your Mailgun, SendGrid, Postmark, AWS SES, or custom email
            forwarder:
          </p>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="h-9 font-mono text-xs bg-muted/50 text-foreground"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyWebhook}
              className="gap-1 text-xs shrink-0"
            >
              {copied ? (
                <CheckCircle2 className="size-3.5 text-blue-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy URL"}
            </Button>
          </div>
        </div>

        {/* Action: Test Webhook Button */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-4 text-blue-500" />
            <span>Webhook Status: Active & Secured</span>
          </div>

          <Button
            size="sm"
            onClick={handleTestIngest}
            disabled={testing || !settings.enabled}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
          >
            <Send className="size-3.5" />
            {testing ? "Testing Ingestion…" : "Test Ingest Sample Attachment"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
