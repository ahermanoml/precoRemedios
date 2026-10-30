import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared 1200×630 share card (site-wide and per medicine). */
export function ogCard({ title, subtitle, footer }: { title: string; subtitle: string; footer: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0b0d0e",
          color: "#e8eae6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(52,211,153,0.15)",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            +
          </div>
          <div style={{ fontSize: 40, fontWeight: 600 }}>MedPreço</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: title.length > 40 ? 60 : 76, lineHeight: 1.05, color: "#34d399", fontWeight: 700 }}>
            {title}
          </div>
          <div style={{ fontSize: 34, color: "#94989b" }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 26, color: "#5f6468" }}>{footer}</div>
      </div>
    ),
    OG_SIZE
  );
}
