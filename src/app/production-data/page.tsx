"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { legacyDataRedirectPath } from "@/lib/allDataRoutes";

/** @deprecated → /all-data?tab=production */
export default function ProductionDataRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    router.replace(
      legacyDataRedirectPath("production-data", searchParams.toString()),
    );
  }, [router, searchParams]);

  return null;
}
