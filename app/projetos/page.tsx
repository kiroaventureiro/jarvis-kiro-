import InternalPage from "../components/InternalPage";
import PrivateArea from "../components/PrivateArea";
import { authorized } from "../../lib/auth";
import { listProjectMemory } from "../../lib/kiro-project-memory";
export const dynamic = "force-dynamic";
export default async function ProjectsPage() {
  const allowed = await authorized();
  return (
    <InternalPage title="Projetos Kiro" eyebrow="Criação e continuidade">
      {allowed ? (
        <>
          <p className="intro">
            Catálogo curado, com personagens, temas e fontes preservados. Nenhum
            projeto está sendo sincronizado automaticamente.
          </p>
          <div className="card-grid">
            {listProjectMemory().map((project) => (
              <article className="card glass" key={project.id}>
                <span className="badge">Memória curada</span>
                <h2>{project.name}</h2>
                <p>{project.topics.join(" · ")}</p>
                <p>
                  Personagens:{" "}
                  {project.characters.join(", ") || "Não definidos"}
                </p>
                <p>Fontes: {project.provenance.join(", ")}</p>
                <p>Conexão ao vivo: não verificada</p>
              </article>
            ))}
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
