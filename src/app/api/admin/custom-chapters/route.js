import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveAdminSession, requireAdminMutationAuth } from "@/lib/adminAuth";
import {
  listAllCustomChaptersAdmin,
  addCustomChapter,
  deleteCustomChapter,
} from "@/lib/customChapters";

export const runtime = "nodejs";

export async function GET() {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const items = await listAllCustomChaptersAdmin();
  return NextResponse.json({ ok: true, items });
}

export async function POST(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const res = await addCustomChapter(body?.slug, {
    title: body?.title,
    label: body?.label,
    images: body?.images,
  });

  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }

  revalidatePath(`/s/komiku/${res.slug}`);
  return NextResponse.json(res);
}

export async function DELETE(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const res = await deleteCustomChapter(id);
  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }

  return NextResponse.json(res);
}
