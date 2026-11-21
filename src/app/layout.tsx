import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/client/top-nav";
import { EMULATOR_ACCOUNT, EMULATOR_ENDPOINT, REGION } from "@/lib/emulator";
import { regionLabel } from "@/lib/format";
import { checkHealth } from "@/lib/health";

const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: { default: "Consolation", template: "%s | Consolation" },
  description: `Web console for the local AWS Emulator at ${EMULATOR_ENDPOINT}`,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const health = await checkHealth();
  return (
    <html lang="en" className={`${roboto.variable} antialiased`}>
      <body className="min-h-screen">
        <TopNav region={REGION} regionName={regionLabel(REGION)} account={EMULATOR_ACCOUNT} healthy={health.ok} />
        <div className="pb-9">{children}</div>
        <footer className="fixed inset-x-0 bottom-0 z-40 flex h-9 items-center gap-5 border-t border-line bg-surface px-4 text-xs font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${health.ok ? "bg-success" : "bg-danger"}`} />
            {health.ok ? "Emulator" : "Emulator offline"}: <span className="font-mono">{EMULATOR_ENDPOINT}</span>
          </span>
          <a href="/settings" className="hover:text-ink">Settings</a>
          <span className="ml-auto hidden sm:inline">Consolation &middot; a local console for AWS Emulator</span>
        </footer>
      </body>
    </html>
  );
}
