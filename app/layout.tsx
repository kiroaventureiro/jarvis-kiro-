import "./style.css";
import "./hologram.css";
import "./holo-response.css";
import "./cinematic.css";
import "./holo-v2.css";
import "./holo-v3.css";
import "./holo-freedom.css";
import "./cosmic.css";
import "./interior-scroll.css";
import { HoloSessionProvider } from "./components/holo/HoloSession";
import InteriorScroll from "./components/InteriorScroll";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Jarvis Kiro | Central Pessoal",
  description: "Assistente pessoal da Kiro Produções",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <HoloSessionProvider><InteriorScroll />{children}</HoloSessionProvider>
      </body>
    </html>
  );
}
