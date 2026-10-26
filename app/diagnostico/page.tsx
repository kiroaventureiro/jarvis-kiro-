import InternalPage from "../components/InternalPage";
import PrivateArea from "../components/PrivateArea";
import { authorized } from "../../lib/auth";
import { getJarvisReadinessReport } from "../../lib/jarvis-readiness-report";
export const dynamic = "force-dynamic";
export default async function DiagnosticsPage() {
  const allowed = await authorized();
  const report = allowed ? getJarvisReadinessReport() : null;
  return (
    <InternalPage title="Diagnóstico" eyebrow="Prontidão do sistema">
      {report ? (
        <>
          <p className="intro">{report.disclaimer}</p>
          <div className="card-grid">
            <article className="card glass">
              <h2>Conexões</h2>
              <p>{report.ecosystem.cataloguedServices} serviços catalogados.</p>
              <p>
                {report.ecosystem.liveConnectionsVerified} conexões verificadas.
              </p>
            </article>
            <article className="card glass">
              <h2>Agente e automação</h2>
              <p>Execução remota: desativada.</p>
              <p>n8n: não conectado.</p>
              <p>Agente Windows: instalação não verificada.</p>
            </article>
            <article className="card glass">
              <h2>Memória</h2>
              <p>Índice histórico preparado.</p>
              <p>Armazenamento persistente de tarefas: não conectado.</p>
            </article>
          </div>
          <section className="glass notice">
            <h2>Pendências de ativação</h2>
            <ul>
              {report.outstanding.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>Publicação em produção: não aprovada.</p>
          </section>
        </>
      ) : (
        <PrivateArea>
          <></>
        </PrivateArea>
      )}
    </InternalPage>
  );
}
