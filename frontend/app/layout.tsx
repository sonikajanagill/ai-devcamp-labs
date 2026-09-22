import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Spark — agentic social posting",
  description:
    "Turn an idea into a researched, drafted, illustrated social post — an orchestrator agent consults your posting memory, then routes to research and draft specialists. Powered by Google ADK, AG-UI and CopilotKit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoMono.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
