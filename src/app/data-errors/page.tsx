"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { legacyDataRedirectPath } from "@/lib/allDataRoutes";

/** @deprecated → /all-data?tab=errors */
export default function DataErrorsRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    router.replace(
      legacyDataRedirectPath("data-errors", searchParams.toString()),
    );
  }, [router, searchParams]);

  return null;
}
