"use client";

import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!key) {
    // No PostHog key — analytics are a no-op in dev
    return;
  }

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false, // we track manually
    capture_pageleave: true,
  });

  initialized = true;
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  // Always include session and device info
  const base = {
    session_id: getSessionId(),
    device_type: window.innerWidth < 768 ? "mobile" : "desktop",
    timestamp: new Date().toISOString(),
  };

  if (initialized) {
    posthog.capture(event, { ...base, ...properties });
  }

  // Also log to console in dev
  if (process.env.NODE_ENV === "development") {
    console.log(`[analytics] ${event}`, { ...base, ...properties });
  }
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("fc_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("fc_session_id", id);
  }
  return id;
}
