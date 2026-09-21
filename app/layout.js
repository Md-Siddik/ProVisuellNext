import "./globals.css"
import Providers from "./providers"

// Ported from Client/index.html.
export const metadata = {
  title: "ProVisuell — Merkevare, synlig, effektivt.",
  icons: { icon: "/assets/ProVisuellFav.png" },
  // Blocks the browser's OWN built-in translate prompt (Chrome's "Translate
  // this page?" bar). The site translates itself through the Header's
  // NO/EN/SV/FI/DA buttons and its own static dictionaries.
  other: { google: "notranslate" },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="nb">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
