"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { generateDCAction } from "./actions";

export function GenerateDCDialog({ sites }: { sites: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([{ id: "", qty: 1, unit: "Nos" }]);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const validItems = items.filter((item) => item.id !== "");
      if (validItems.length === 0) {
        alert("Please add at least one item.");
        setLoading(false);
        return;
      }

      const result = await generateDCAction({
        dc_number: fd.get("dc_number") as string,
        dc_type: fd.get("dc_type") as string,
        site_id: fd.get("site_id") as string,
        date: fd.get("date") as string,
        deliver_to: fd.get("deliver_to") as string,
        items: validItems,
      });

      if (!result.success) {
        const detailsMsg = result.details ? JSON.stringify(result.details) : result.error;
        alert("Failed to generate DC: " + detailsMsg);
        return;
      }

      setOpen(false);
      setItems([{ id: "", qty: 1, unit: "Nos" }]);
      router.refresh();
      // Automatically trigger download
      const resData = result.res as { pdf_url?: string } | undefined;
      if (resData?.pdf_url) {
        window.location.href = resData.pdf_url;
      }
    } catch (err: unknown) {
      alert("Failed to generate DC: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  const addItem = () => setItems([...items, { id: "", qty: 1, unit: "Nos" }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: "id" | "qty" | "unit", value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Generate DC
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Generate Delivery Challan</DialogTitle>
          <DialogDescription>
            Enter delivery details and products to generate and download a PDF Delivery Challan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dc_number">DC Number</Label>
              <Input id="dc_number" name="dc_number" placeholder="e.g. 28/2026-27" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dc_type">Type</Label>
              <select
                id="dc_type"
                name="dc_type"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="returnable">Returnable DC</option>
                <option value="non_returnable">Non-Returnable DC</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site_id">Delivery Site Location</Label>
              <select
                id="site_id"
                name="site_id"
                required
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select destination site...</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Products to Deliver</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 p-1">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Product description..."
                    value={item.id}
                    onChange={(e) => updateItem(index, "id", e.target.value)}
                    required
                  />
                  <Input
                    type="number"
                    min="1"
                    className="w-20"
                    value={item.qty}
                    onChange={(e) => updateItem(index, "qty", parseInt(e.target.value))}
                    required
                  />
                  <Input
                    className="w-24"
                    placeholder="Unit (Kg, Litre, Lot...)"
                    value={item.unit}
                    onChange={(e) => updateItem(index, "unit", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate & Download"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
