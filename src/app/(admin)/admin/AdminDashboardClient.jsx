"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_IMAGE_DOMAINS } from "@/lib/security";

export default function AdminDashboardClient({ initialUser, initialCsrfToken }) {
  const router = useRouter();
  const [csrfToken] = useState(initialCsrfToken || "");
  const [activeTab, setActiveTab] = useState("announcements");
  const [notice, setNotice] = useState(null);

  /* Announcements state */
  const [announcements, setAnnouncements] = useState([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annLevel, setAnnLevel] = useState("info");

  /* Maintenance state */
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintMessage, setMaintMessage] = useState("");

  /* Blocklist state */
  const [blocklist, setBlocklist] = useState([]);
  const [blockKeyword, setBlockKeyword] = useState("");
  const [blockReason, setBlockReason] = useState("");

  /* Custom Chapters state */
  const [customChapters, setCustomChapters] = useState([]);
  const [ccSlug, setCcSlug] = useState("");
  const [ccTitle, setCcTitle] = useState("");
  const [ccLabel, setCcLabel] = useState("");
  const [ccImages, setCcImages] = useState("");

  /* Health checks state */
  const [healthChecks, setHealthChecks] = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    }),
    [csrfToken]
  );

  const loadAll = useCallback(async () => {
    try {
      const [annRes, maintRes, blkRes, ccRes] = await Promise.all([
        fetch("/api/admin/announcements"),
        fetch("/api/admin/site-status"),
        fetch("/api/admin/blocklist"),
        fetch("/api/admin/custom-chapters"),
      ]);

      if (annRes.status === 401) {
        router.push("/admin/login");
        return;
      }

      const [annData, maintData, blkData, ccData] = await Promise.all([
        annRes.json(),
        maintRes.json(),
        blkRes.json(),
        ccRes.json(),
      ]);

      if (annData.ok) setAnnouncements(annData.items || []);
      if (maintData.ok) {
        setMaintEnabled(Boolean(maintData.enabled));
        setMaintMessage(maintData.message || "");
      }
      if (blkData.ok) setBlocklist(blkData.items || []);
      if (ccData.ok) setCustomChapters(ccData.items || []);
    } catch (err) {
      setNotice({ type: "error", text: "Gagal memuat data: " + err.message });
    }
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", {
      method: "POST",
      headers: authHeaders(),
    });
    router.push("/admin/login");
    router.refresh();
  }

  async function handleAddAnnouncement(e) {
    e.preventDefault();
    setNotice(null);
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title: annTitle, body: annBody, level: annLevel, active: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setNotice({ type: "error", text: data.error || "Gagal menambah pengumuman." });
      return;
    }
    setAnnTitle("");
    setAnnBody("");
    setNotice({ type: "success", text: "Pengumuman berhasil ditambahkan." });
    loadAll();
  }

  async function handleToggleAnnouncement(id, active) {
    await fetch("/api/admin/announcements", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id, active: !active }),
    });
    loadAll();
  }

  async function handleDeleteAnnouncement(id) {
    await fetch(`/api/admin/announcements?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    loadAll();
  }

  async function handleSaveMaintenance(e) {
    e.preventDefault();
    setNotice(null);
    const res = await fetch("/api/admin/site-status", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ enabled: maintEnabled, message: maintMessage }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setNotice({ type: "success", text: "Status pemeliharaan berhasil diperbarui." });
    } else {
      setNotice({ type: "error", text: data.error || "Gagal menyimpan status." });
    }
  }

  async function handleAddBlocklist(e) {
    e.preventDefault();
    setNotice(null);
    const res = await fetch("/api/admin/blocklist", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ keyword: blockKeyword, reason: blockReason }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setNotice({ type: "error", text: data.error || "Gagal menambah blocklist." });
      return;
    }
    setBlockKeyword("");
    setBlockReason("");
    setNotice({ type: "success", text: "Kata kunci berhasil ditambahkan ke blocklist." });
    loadAll();
  }

  async function handleDeleteBlocklist(id) {
    await fetch(`/api/admin/blocklist?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    loadAll();
  }

  async function handleAddCustomChapter(e) {
    e.preventDefault();
    setNotice(null);
    const images = ccImages
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/admin/custom-chapters", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        slug: ccSlug,
        title: ccTitle,
        label: ccLabel,
        images,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setNotice({ type: "error", text: data.error || "Gagal menambah custom chapter." });
      return;
    }
    setCcSlug("");
    setCcTitle("");
    setCcLabel("");
    setCcImages("");
    setNotice({ type: "success", text: `Custom chapter berhasil ditambahkan untuk ${data.slug}.` });
    loadAll();
  }

  async function handleDeleteCustomChapter(id) {
    await fetch(`/api/admin/custom-chapters?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    loadAll();
  }

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/admin/health");
      const data = await res.json();
      if (data.ok) setHealthChecks(data.checks || []);
    } finally {
      setHealthLoading(false);
    }
  }

  const TABS = [
    { id: "announcements", label: "Pengumuman" },
    { id: "maintenance", label: "Maintenance" },
    { id: "blocklist", label: "Blocklist" },
    { id: "custom-chapters", label: "Custom Chapter" },
    { id: "health", label: "Cek Integrasi" },
  ];

  return (
    <div className="min-h-screen px-4 py-6 max-w-4xl mx-auto" style={{ background: "#080a0f" }}>
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl mb-6"
        style={{ background: "#0d1018", border: "1px solid rgba(245,158,11,0.18)" }}
      >
        <div>
          <h1 className="text-lg font-bold text-white">TaaComics Admin Panel</h1>
          <p className="text-xs text-gray-400">
            Login sebagai <span className="text-amber-400 font-semibold">{initialUser?.username}</span> ({initialUser?.role})
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
          }}
        >
          Keluar (Revoke Sesi)
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 hide-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTab(t.id);
              setNotice(null);
              if (t.id === "health" && healthChecks.length === 0) runHealthCheck();
            }}
            className="text-xs font-semibold px-4 py-2 rounded-xl flex-shrink-0 transition-all"
            style={{
              background:
                activeTab === t.id
                  ? "linear-gradient(135deg,#f59e0b,#ef4444)"
                  : "rgba(255,255,255,0.05)",
              color: activeTab === t.id ? "#080a0f" : "#d1d5db",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-xs"
          style={{
            background:
              notice.type === "error" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
            border: `1px solid ${
              notice.type === "error" ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)"
            }`,
            color: notice.type === "error" ? "#f87171" : "#4ade80",
          }}
        >
          {notice.text}
        </div>
      )}

      {/* TAB 1: Announcements */}
      {activeTab === "announcements" && (
        <div className="space-y-5">
          <form
            onSubmit={handleAddAnnouncement}
            className="p-5 rounded-2xl space-y-3"
            style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h2 className="text-sm font-bold text-white">Tambah Pengumuman Baru</h2>
            <input
              type="text"
              required
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Judul pengumuman..."
              className="w-full text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <textarea
              rows={2}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Isi pengumuman..."
              className="w-full text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <div className="flex items-center gap-3">
              <select
                value={annLevel}
                onChange={(e) => setAnnLevel(e.target.value)}
                className="text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                style={{ background: "#141824", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <option value="info">Info (Biru)</option>
                <option value="warning">Warning (Merah)</option>
                <option value="success">Success (Hijau)</option>
              </select>
              <button
                type="submit"
                className="text-xs font-bold px-5 py-2.5 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
              >
                Simpan Pengumuman
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl"
                style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div>
                  <p className="text-sm font-bold text-white">
                    {a.title}{" "}
                    <span className="text-[10px] px-2 py-0.5 rounded-full ml-1 bg-white/10 text-gray-300">
                      {a.level}
                    </span>
                  </p>
                  {a.body && <p className="text-xs text-gray-400 mt-0.5">{a.body}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAnnouncement(a.id, a.active)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{
                      background: a.active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                      color: a.active ? "#4ade80" : "#9ca3af",
                    }}
                  >
                    {a.active ? "Aktif" : "Nonaktif"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAnnouncement(a.id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-400 bg-red-500/10"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Maintenance */}
      {activeTab === "maintenance" && (
        <form
          onSubmit={handleSaveMaintenance}
          className="p-5 rounded-2xl space-y-4"
          style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 className="text-sm font-bold text-white">Pengaturan Mode Pemeliharaan</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={maintEnabled}
              onChange={(e) => setMaintEnabled(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-sm text-gray-200">Aktifkan Mode Maintenance di Situs Utama</span>
          </label>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Pesan Maintenance</label>
            <textarea
              rows={3}
              value={maintMessage}
              onChange={(e) => setMaintMessage(e.target.value)}
              className="w-full text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <button
            type="submit"
            className="text-xs font-bold px-5 py-2.5 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
          >
            Simpan Status Maintenance
          </button>
        </form>
      )}

      {/* TAB 3: Blocklist */}
      {activeTab === "blocklist" && (
        <div className="space-y-5">
          <form
            onSubmit={handleAddBlocklist}
            className="p-5 rounded-2xl space-y-3"
            style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h2 className="text-sm font-bold text-white">Tambah Kata Kunci / Judul Blocklist</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={blockKeyword}
                onChange={(e) => setBlockKeyword(e.target.value)}
                placeholder="Kata kunci judul (huruf kecil)..."
                className="text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Alasan (opsional)..."
                className="text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <button
              type="submit"
              className="text-xs font-bold px-5 py-2.5 rounded-xl text-white"
              style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
            >
              Tambah ke Blocklist
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {blocklist.map((b) => (
              <div
                key={b.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.08)", color: "#e5e7eb" }}
              >
                <span>{b.keyword}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteBlocklist(b.id)}
                  className="text-red-400 hover:text-red-300 font-bold"
                  aria-label={`Hapus ${b.keyword}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Custom Chapters */}
      {activeTab === "custom-chapters" && (
        <div className="space-y-5">
          <form
            onSubmit={handleAddCustomChapter}
            className="p-5 rounded-2xl space-y-3"
            style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h2 className="text-sm font-bold text-white">Tambah Custom Chapter</h2>
            <p className="text-[11px] text-gray-400">
              Domain gambar yang diizinkan: {ALLOWED_IMAGE_DOMAINS.join(", ")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={ccSlug}
                onChange={(e) => setCcSlug(e.target.value)}
                placeholder="Slug (mis: one-punch-man)"
                className="text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <input
                type="text"
                value={ccTitle}
                onChange={(e) => setCcTitle(e.target.value)}
                placeholder="Judul Manga (opsional)"
                className="text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <input
                type="text"
                required
                value={ccLabel}
                onChange={(e) => setCcLabel(e.target.value)}
                placeholder="Label (mis: Chapter 205)"
                className="text-sm text-white px-3.5 py-2.5 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <textarea
              rows={4}
              required
              value={ccImages}
              onChange={(e) => setCcImages(e.target.value)}
              placeholder="Satu URL gambar HTTPS per baris..."
              className="w-full text-xs font-mono text-white px-3.5 py-2.5 rounded-xl outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <button
              type="submit"
              className="text-xs font-bold px-5 py-2.5 rounded-xl text-white"
              style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
            >
              Simpan Custom Chapter
            </button>
          </form>

          <div className="space-y-2">
            {customChapters.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl"
                style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div>
                  <p className="text-sm font-bold text-white">
                    {ch.slug} — <span className="text-amber-400">{ch.label}</span>
                  </p>
                  <p className="text-xs text-gray-400">{ch.pageCount} halaman gambar</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCustomChapter(ch.id)}
                  className="text-xs px-3 py-1.5 rounded-lg text-red-400 bg-red-500/10"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Integration Health */}
      {activeTab === "health" && (
        <div
          className="p-5 rounded-2xl space-y-4"
          style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Status Integrasi &amp; Database</h2>
            <button
              type="button"
              onClick={runHealthCheck}
              disabled={healthLoading}
              className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
              style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24" }}
            >
              {healthLoading ? "Memeriksa..." : "Uji Ulang"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {healthChecks.map((c) => (
              <div
                key={c.name}
                className="p-4 rounded-xl flex items-center justify-between"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${c.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                }}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.latencyMs} ms</p>
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: c.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                    color: c.ok ? "#4ade80" : "#f87171",
                  }}
                >
                  {c.ok ? "ONLINE" : "ERROR"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
