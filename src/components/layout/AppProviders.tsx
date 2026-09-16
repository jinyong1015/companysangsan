"use client";

import { usePathname } from "next/navigation";
import { GlobalFilterSection } from "@/components/filters/FilterCards";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { DemoDataBanner } from "@/components/ui/DemoDataBanner";
import { DataSourceProvider } from "@/context/DataSourceContext";
import { FilterProvider } from "@/context/FilterContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";

function shouldShowGlobalFilters(pathname: string) {
  if (pathname.startsWith("/manage")) return false;
  if (pathname.startsWith("/downtime/") && pathname !== "/downtime") return false;
  return true;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showFilters = shouldShowGlobalFilters(pathname);

  return (
    <>
      <GlobalHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-6 md:px-5 lg:px-6">
        <DemoDataBanner />
        {showFilters ? <GlobalFilterSection /> : null}
        {children}
      </main>
    </>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DataSourceProvider>
          <FilterProvider>
            <AppShell>{children}</AppShell>
          </FilterProvider>
        </DataSourceProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
