"use client";
import { useState } from "react";
import { skillToolBindings, agentToolBindings } from "../../lib/cognitive/skill-tools";
import type { discoverSkillTools } from "../../lib/cognitive/skill-discovery";
type Inventory = Awaited<ReturnType<typeof discoverSkillTools>>;
export default function SkillConnections() {
  const [data, setData] = useState<Inventory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function verify() {
    setBusy(true); setError(""); setData(null);
    try {
      const response = await fetch("/api/director/local-skills?verify=1", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw Error(response.status === 401 ? "Entre como proprietário em Configurações para consultar as conexões." : "Não consegui verificar as conexões agora.");
      setData((await response.json()).tooling);
    } catch (e) { setError(e instanceof Error ? e.message : "Consulta indisponível."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Skills e agentes conectados" className="glass notice">
    <h2>20 skills e 4 perfis especialistas</h2>
    <p>Disponíveis como orientação nas respostas do Jarvis. As ferramentas de cada habilidade usam as conexões e permissões existentes.</p>
    <button className="subtle-button" disabled={busy} onClick={() => void verify()}>{busy ? "Verificando conexões…" : "Verificar conexões dos skills"}</button>
    {error ? <p role="alert">{error}</p> : null}
    {data ? <div role="status">
      <p>{data.n8n.verifiedNow ? `n8n consultado agora: ${data.n8n.workflowCount} workflows${data.n8n.partial ? " nesta página parcial" : ""}.` : data.n8n.authorized ? "Autorização n8n salva; leitura atual não confirmada." : "n8n sem autorização salva neste ambiente."}</p>
      <p>Relatório n8n: {data.n8n.reportConfigured ? "configurado; execute pelo painel n8n ou pela conversa" : "executor não configurado neste ambiente"}.</p>
      <p>Conexões diretas com leitura autorizada salva: {data.direct.filter(d => d.authorized).map(d => d.provider).join(", ") || "nenhuma"}. Não foram testadas nesta consulta.</p>
    </div> : null}
    <p><a href="/configuracoes">Abrir conector n8n</a> · <a href="/conexoes">Abrir conexões diretas</a></p>
    <p>Git, SQL, testes, builds e scanners exigem seus próprios executores. Um perfil especialista não inicia um agente independente.</p>
    <div className="card-grid">
      {skillToolBindings().map(skill => <article className="card glass" key={skill.id}>
        <h3 style={{ overflowWrap: "anywhere" }}>{skill.id}</h3><p>{skill.description}</p>
        <p>Orientação disponível · {skill.group}</p>
        <p>Ferramentas: {skill.tools.join(", ")}</p>
        {data ? <p>{data.skills.find(s => s.id === skill.id)?.tools.map(t => `${t.id}: ${t.verifiedNow ? "leitura verificada agora" : t.authorized ? "autorização salva" : "sem autorização salva"}`).join("; ")}</p> : null}
        <p>{skill.requirement}</p>
      </article>)}
    </div>
    <h3>Perfis de agentes</h3>
    <ul>{agentToolBindings().map(role => <li key={role.id}><strong>{role.id}</strong>: {role.purpose} Ferramentas de apoio: {role.tools.join(", ")}. Sem execução independente.</li>)}</ul>
  </section>;
}
