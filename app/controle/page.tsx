import InternalPage from "../components/InternalPage";
import PrivateArea from "../components/PrivateArea";
import { authorized } from "../../lib/auth";
import skills from "../../config/jarvis-local-skills.json";
export const dynamic = "force-dynamic";
export default async function ControlPage() {
  const allowed = await authorized();
  return (
    <InternalPage title="Controle" eyebrow="Agentes e operações">
      {allowed ? (
        <>
          <p className="intro">
            Habilidades locais e fluxos preparados. Execuções externas, agentes
            Windows e publicações continuam sujeitos às políticas de aprovação
            existentes.
          </p>
          <div className="card-grid">
            <article className="card glass">
              <h2>Habilidades locais</h2>
              <p>Consulta de projetos, continuidade e rascunhos criativos.</p>
              <ul>
                {skills.skills.map((skill) => (
                  <li key={skill.id}>
                    {(
                      {
                        "projects.list": "Listar projetos",
                        "projects.details": "Consultar projeto",
                        "creative.continuity": "Revisar continuidade",
                        "creative.scenes": "Preparar cenas",
                      } as Record<string, string>
                    )[skill.id] || skill.id}{" "}
                    · {skill.operation === "read" ? "Consulta" : "Rascunho"}
                  </li>
                ))}
              </ul>
            </article>
            <article className="card glass">
              <h2>Produção criativa</h2>
              <p>
                Motor de planos, cenas e revisão de continuidade preservado nas
                APIs do diretor. Geração externa e publicação não ativadas.
              </p>
            </article>
            <article className="card glass">
              <h2>Tarefas e automações</h2>
              <p>
                Contratos de tarefas e registro n8n preservados. O armazenamento
                persistente de tarefas ainda não está configurado.
              </p>
              <p>
                Não há execução remota irrestrita ou agente local instalado por
                esta interface.
              </p>
            </article>
          </div>
        </>
      ) : (
        <PrivateArea>
          <></>
        </PrivateArea>
      )}
    </InternalPage>
  );
}
