import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carteira Desapego",
  robots: { index: false, follow: false },
};

export default function LayoutDoApp({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="app">{children}</main>;
}
