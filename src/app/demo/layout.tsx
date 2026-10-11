import type { ReactNode } from "react";
import { DemoBanner } from "@/components/demo-app";
export const metadata = { title: "Demo", robots: { index: false } };
export default function DemoLayout({ children }: { children: ReactNode }) {
  return <><DemoBanner />{children}</>;
}
