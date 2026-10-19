import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--fonte-corpo",
});

const SITE = "https://desapego.festivaldesapeguese.com.br";
const TITULO = "Moeda Social Desapego — Uma nova economia é possível";
const DESCRICAO =
  "A Desapego é a moeda social do Festival: dinheiro alternativo que circula " +
  "nos territórios, estimula a economia local e fortalece as relações entre " +
  "pessoas, iniciativas e pequenos negócios.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITULO,
  description: DESCRICAO,
  applicationName: "Desapego",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Moeda Social Desapego",
    locale: "pt_BR",
    title: TITULO,
    description: DESCRICAO,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Cédula de 1 Desapego, com folhagem tropical e um hibisco vermelho.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
    images: ["/og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#053017",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
