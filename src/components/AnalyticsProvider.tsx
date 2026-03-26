"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, track } from "@/lib/analytics";

export default function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    // Track page views
    const eventMap: Record<string, string> = {
      "/": "landing_view",
      "/sequence": "sequence_start",
      "/summary": "summary_view",
    };
    const event = eventMap[pathname];
    if (event) {
      track(event, { path: pathname });
    }
    // Share pages tracked separately with referrer data
    if (pathname.startsWith("/s/")) {
      track("share_card_view", { path: pathname });
    }
  }, [pathname]);

  return <>{children}</>;
}
