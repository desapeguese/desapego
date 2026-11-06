import type { Metadata, Viewport } from "next";
import { fontesDoApp } from "../fontes";
import { RegistrarSw } from "./registrar-sw";

export const metadata: Metadata = {
  title: "Carteira Desapego",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Desapego", statusBarStyle: "default" },
};

// O app é claro como o papel da cédula; a landing continua escura.
export const viewport: Viewport = { themeColor: "#D9DFCF", colorScheme: "light" };

export default function LayoutDoApp({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className={`app ${fontesDoApp}`}>
      {children}
      <RegistrarSw />
    </main>
  );
}
