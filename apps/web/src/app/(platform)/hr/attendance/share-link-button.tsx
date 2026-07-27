"use client";

import { Share2, Check } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

export function ShareCheckInLinkButton() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/checkin`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Mobile Check-In Link copied! Send this to your employees on WhatsApp/Telegram.");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-1.5 cursor-pointer text-xs"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Share2 className="size-3.5" />}
      {copied ? "Link Copied!" : "Share Mobile Link"}
    </Button>
  );
}
