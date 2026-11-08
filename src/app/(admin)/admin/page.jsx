import { redirect } from "next/navigation";
import { getActiveAdminSession } from "@/lib/adminAuth";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Panel - TaaComics",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getActiveAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminDashboardClient
      initialUser={session.user}
      initialCsrfToken={session.csrfToken}
    />
  );
}
