import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Moeda Social Desapego",
    short_name: "Desapego",
    description: "Carteira da Desapego, a moeda social do Festival Desapegue-se.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#D9DFCF",
    theme_color: "#D9DFCF",
    icons: [
      { src: "/icone-192-v1.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512-v1.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-mascara-512-v1.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
