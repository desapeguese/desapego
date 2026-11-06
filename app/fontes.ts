import { Barlow, Barlow_Condensed } from "next/font/google";

// As fontes do app. A condensada pesada é a dos numerais e do "DESAPEGO" da
// cédula; a normal, a do "moeda social".
const titulo = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--fonte-titulo",
});

const texto = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--fonte-app",
});

export const fontesDoApp = `${titulo.variable} ${texto.variable}`;
