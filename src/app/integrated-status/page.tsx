"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { legacyDataRedirectPath } from "@/lib/allDataRoutes";

/** @deprecated → /all-data?tab=integrated */
export default function IntegratedStatusRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    router.replace(
      legacyDataRedirectPath("integrated-status", searchParams.toString()),
    );
  }, [router, searchParams]);

  return null;
}
