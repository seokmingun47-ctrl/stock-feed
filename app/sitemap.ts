import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://stock-feed-two.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/pricing", "/privacy", "/terms"];
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "hourly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
