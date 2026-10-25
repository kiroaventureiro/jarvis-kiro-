import Link from "next/link";
import inventory from "../../config/kiro-ecosystem-inventory.json";
export default function IntegrationsPage(){
 const services=inventory.services;
 return <main style={{background:"#090312",color:"#f4edff",minHeight:"100vh",padding:"24px",fontFamily:"system-ui"}}>
 <div style={{maxWidth:1080,margin:"0 auto"}}>
 <Link href="/" style={{color:"#c9a8ff"}}>← Central Jarvis</Link>
 <p style={{letterSpacing:3,color:"#bd9ae4"}}>KIRO PRODUÇÕES · ARQUITETURA</p>
 <h1>Central de integrações</h1>
 <p>Serviços planejados: {services.length}. Contas conectadas e verificadas nesta central: 0.</p>
 <p>Este painel é um inventário de planejamento. Não fornece acesso a nenhuma conta nem permite ativar integrações.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
 {services.map(service=><article key={service.name} style={{background:"#1c1030",border:"1px solid #42256b",borderRadius:12,padding:18}}>
 <h2 style={{fontSize:19,margin:"0 0 8px"}}>{service.name}</h2>
 <p style={{fontSize:14,color:"#cbb7df"}}>{service.category}</p>
 <p>{service.purpose}</p>
 <p style={{fontSize:13,color:"#cab4e0"}}>Conexão: planejada · Não autorizada</p>
 <p style={{fontSize:13,color:"#cab4e0"}}>Método previsto: {service.connectionStrategy}</p>
 </article>)}
 </div></div></main>
}
