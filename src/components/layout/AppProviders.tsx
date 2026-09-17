"use client";

import { usePathname } from "next/navigation";
import { GlobalFilterSection } from "@/components/filters/FilterCards";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { SettingsModal } from "@/components/admin/SettingsModal";
import { DemoDataBanner } from "@/components/ui/DemoDataBanner";
import { AdminProvider } from "@/context/AdminContext";
import { DataSourceProvider } from "@/context/DataSourceContext";
import { FilterProvider } from "@/context/FilterContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";

function shouldShowGlobalFilters(pathname: string) {
  if (pathname.startsWith("/manage")) return false;
  if (pathname.startsWith("/downtime/") && pathname !== "/downtime") return false;
  return true;
}

/** 가동률·비가동은 화면 내 조회월로 기간을 제어한다 */
function shouldHideGlobalPeriod(pathname: string) {
  return pathname === "/utilization" || pathname === "/downtime";
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showFilters = shouldShowGlobalFilters(pathname);
  const hidePeriod = shouldHideGlobalPeriod(pathname);

  return (
    <>
      <GlobalHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-6 md:px-5 lg:px-6">
        <DemoDataBanner />
        {showFilters ? <GlobalFilterSection hidePeriod={hidePeriod} /> : null}
        {children}
      </main>
      <SettingsModal />
    </>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AdminProvider>
          <DataSourceProvider>
            <FilterProvider>
              <AppShell>{children}</AppShell>
            </FilterProvider>
          </DataSourceProvider>
        </AdminProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
