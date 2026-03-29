import type { Metadata } from "next";
import "./globals.css";
import RouteTransitionFeedback from "@/components/navigation/RouteTransitionFeedback";

export const metadata: Metadata = {
  title: "Reigns Narrative Editor",
  description: "MVP event system editor inspired by Reigns"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RouteTransitionFeedback />
        {children}
      </body>
    </html>
  );
}