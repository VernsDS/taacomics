import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveAdminSession, requireAdminMutationAuth } from "@/lib/adminAuth";
import {
  readAnnouncements,
  createAnnouncement,
  toggleAnnouncementActive,
  deleteAnnouncementById,
} from "@/lib/announcementsStore";

export const runtime = "nodejs";

export async function GET() {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const data = await readAnnouncements();
  return NextResponse.json({ ok: true, items: data.items });
}

export async function POST(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const res = await createAnnouncement(body);
  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/api/announcements");
  return NextResponse.json(res);
}

export async function PATCH(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const res = await toggleAnnouncementActive(body?.id, body?.active);
  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/api/announcements");
  return NextResponse.json(res);
}

export async function DELETE(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const res = await deleteAnnouncementById(id);
  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/api/announcements");
  return NextResponse.json(res);
}
