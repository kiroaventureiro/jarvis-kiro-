import InternalPage from "../components/InternalPage";
import PrivateArea from "../components/PrivateArea";
import { authorized } from "../../lib/auth";
import memory from "../../config/operational-memory.json";
export const dynamic = "force-dynamic";
export default async function MemoryPage() {
  const allowed = await authorized();
  return (
    <InternalPage title="Memória" eyebrow="Conhecimento e fontes">
      {allowed ? (
        <>
          <p className="intro">
            Índice curado do projeto. As fontes abaixo não representam
            sincronização ao vivo.
          </p>
          <div className="card-grid">
            {memory.records.map((record) => (
              <article className="card glass" key={record.id}>
                <span className="badge">{record.project}</span>
                <h2>{record.topic}</h2>
                <p>{record.summary}</p>
                <p>Decisão: {record.decision}</p>
                <p>
                  Origem: {record.source} · Confiança: {record.confidence}
                </p>
                <p>Registro: {record.recorded_at}</p>
                <p>Referência: {record.retrieval_reference}</p>
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
