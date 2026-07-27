import { NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/api/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const djangoRes = await fetch(`${internalApiUrl()}/api/v1/hr/attendance/checkin/`, {
      method: "POST",
      body: formData,
    });
    const data = await djangoRes.json();
    return NextResponse.json(data, { status: djangoRes.status });
  } catch (err) {
    return NextResponse.json(
      { matched: false, message: err instanceof Error ? err.message : "Public check-in failed." },
      { status: 500 },
    );
  }
}
