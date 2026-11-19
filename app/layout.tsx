import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = { title: "Cameroon openIMIS Mock", description: "Local CSU API contract mock" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
