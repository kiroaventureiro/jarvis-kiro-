import InternalPage from "../components/InternalPage";
import Link from "next/link";
import DeviceAccess from "../components/DeviceAccess";
import OwnerLogin from "../components/OwnerLogin";
import MemorySyncSettings from "../components/MemorySyncSettings";
import AbacusBudgetSettings from "../components/AbacusBudgetSettings";
import VoiceSettings from "../components/VoiceSettings";
export default function SettingsPage() {
  return (
    <InternalPage title="Configurações" eyebrow="Preferências e acesso">
      <section className="glass notice">
        <OwnerLogin />
        <DeviceAccess />
      </section>
      <section className="glass notice"><h2>Central de Conexões</h2><p>Explore o catálogo de IAs, redes sociais, voz, vídeos e ferramentas para integrar futuramente ao Jarvis.</p><Link href="/conexoes">Abrir Central de Conexões →</Link></section>
      <MemorySyncSettings />
      <AbacusBudgetSettings />
      <VoiceSettings />
      <div className="card-grid">
        <article className="glass card">
          <h2>Voz e áudio</h2>
          <p>
            Microfone e reprodução são controlados na interface do Jarvis. O
            microfone só é solicitado ao ativar a conversa por voz.
          </p>
        </article>
        <article className="glass card">
          <h2>Aparência e movimento</h2>
          <p>
            A interface acompanha a preferência de movimento reduzido do seu
            sistema. As animações pausam quando a página não está visível.
          </p>
        </article>
        <article className="glass card">
          <h2>Privacidade da conversa</h2>
          <p>
            O histórico do HUD permanece apenas enquanto esta página está
            aberta. Nenhuma nova persistência de conversas foi ativada.
          </p>
          <p>Encerrar a sessão interrompe a chamada e libera o microfone.</p>
        </article>
      </div>
    </InternalPage>
  );
}
