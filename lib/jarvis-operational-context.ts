import "server-only";
export function jarvisOperationalContext():string {
 const supabase=!!process.env.SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY;
 const memory= supabase&&!!process.env.JARVIS_MEMORY_ENCRYPTION_KEY;
 const abacus=!!process.env.ABACUS_API_KEY;
 const allowed=process.env.JARVIS_ABACUS_PAID_ALLOWED==="true";
 return " Estado das CONFIGURAÇÕES DESTE DEPLOY (apenas presença de variáveis, não verifica comunicação externa): "+
 JSON.stringify({supabaseCredentialsConfigured:supabase,encryptedMemoryCredentialsConfigured:memory,abacusCredentialsConfigured:abacus,abacusUseAuthorized:allowed})+
 ". Não diga que Supabase não está configurado se supabaseCredentialsConfigured for verdadeiro. "+
 "Não confunda configuração com conexão testada ou dados atuais. Verificação operacional exige endpoint autorizado. "+
 "Em interações por voz, escreva linguagem natural sem Markdown, asteriscos de ênfase ou listas excessivas.";
}
