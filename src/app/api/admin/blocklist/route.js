import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveAdminSession, requireAdminMutationAuth } from "@/lib/adminAuth";
import {
  listBlocklistEntries,
  addBlocklistKeyword,
  removeBlocklistKeyword,
} from "@/lib/blocklist";

export const runtime = "nodejs";

export async function GET() {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const items = await listBlocklistEntries();
  return NextResponse.json({ ok: true, items });
}

export async function POST(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const res = await addBlocklistKeyword(body?.keyword, body?.reason);
  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/search");
  return NextResponse.json(res);
}

export async function DELETE(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || searchParams.get("keyword");
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID atau keyword wajib diisi." }, { status: 400 });
  }

  const res = await removeBlocklistKeyword(id);
  revalidatePath("/");
  revalidatePath("/search");
  return NextResponse.json(res);
}
