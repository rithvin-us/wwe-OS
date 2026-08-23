"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { toast } from "sonner";

import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

type State = "checking" | "unsupported" | "subscribed" | "not-subscribed";

export function PushNotificationsCard() {
  const [state, setState] = useState<State>("checking");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    getExistingSubscription()
      .then((sub) => setState(sub ? "subscribed" : "not-subscribed"))
      .catch(() => setState("not-subscribed"));
  }, []);

  async function handleEnable() {
    setLoading(true);
    const result = await subscribeToPush();
    setLoading(false);
    if (result.ok) {
      setState("subscribed");
      toast.success("Push notifications enabled on this device.");
    } else {
      toast.error(result.error || "Could not enable push notifications.");
    }
  }

  async function handleDisable() {
    setLoading(true);
    const result = await unsubscribeFromPush();
    setLoading(false);
    if (result.ok) {
      setState("not-subscribed");
      toast.success("Push notifications turned off on this device.");
    } else {
      toast.error(result.error || "Could not disable push notifications.");
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-400" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get a popup on this device for approvals, alerts, and reminders — even when the tab
          isn&apos;t open.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {state === "checking" ? (
          <p className="text-sm text-muted-foreground">Checking this device&apos;s status…</p>
        ) : state === "unsupported" ? (
          <p className="text-sm text-muted-foreground">
            This browser doesn&apos;t support push notifications. Try a recent Chrome, Edge, or
            Firefox — on iPhone, add WWE OS to your home screen first.
          </p>
        ) : state === "subscribed" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">Enabled on this device.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleDisable}
            >
              <BellOff className="mr-1.5 size-4" />
              {loading ? "Turning off…" : "Turn off"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Not enabled on this device yet.</p>
            <Button type="button" size="sm" disabled={loading} onClick={handleEnable}>
              <Bell className="mr-1.5 size-4" />
              {loading ? "Enabling…" : "Enable push notifications"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
