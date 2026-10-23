"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#080a0f",
          color: "#fff",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#f59e0b", fontWeight: 700, letterSpacing: 4, marginBottom: 8 }}>
            TAACOMICS
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>
            Terjadi kesalahan
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>
            Ada gangguan pada situs. Coba muat ulang halaman ini.
          </p>
          <button
            onClick={() => reset()}
            style={{
              border: "none",
              cursor: "pointer",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              padding: "12px 24px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#f59e0b,#ef4444)",
            }}
          >
            Muat Ulang
          </button>
        </div>
      </body>
    </html>
  );
}
