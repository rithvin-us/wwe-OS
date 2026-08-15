import { djangoFetchPage } from "@/lib/api/server";

/**
 * Real usage counts for the Services page — one cheap page_size=1 request
 * per service, reading only the pagination count. Never fabricate a number:
 * a failed or unreachable call returns null, and the page shows nothing
 * rather than a guess.
 */

async function count(path: string): Promise<number | null> {
  try {
    const { meta } = await djangoFetchPage<unknown[]>(path);
    return meta.count;
  } catch {
    return null;
  }
}

export async function getDocumentsScannedCount(): Promise<number | null> {
  return count("/api/v1/documents/documents/?page_size=1");
}

export async function getTelegramBillsCount(): Promise<number | null> {
  return count("/api/v1/purchase/bills/?source_channel=telegram&page_size=1");
}

export async function getNotificationsSentCount(): Promise<number | null> {
  return count("/api/v1/notifications/?page_size=1");
}
