# Sistema Origem — histórico do Supabase legado
Data de registro: 2026-10-25
Fonte principal: relato do proprietário em conversa com o Jarvis.
Estado da evidência: contexto relatado, não auditoria independente.

## Origem da decisão
O proprietário informou que a base do Sistema Origem foi transferida/reorganizada. O projeto Supabase legado perdeu utilidade após sucessivas reestruturações e remoção de dados considerados desnecessários. O limite de recursos havia sido atingido e também existiam outros fatores não detalhados. A localização exata e os detalhes do banco atual ainda **não foram identificados nem verificados**.

## Fonte técnica identificada
- Provedor: Supabase
- Nome do projeto legado: `sistema-origem-kiro`
- Project ID: `niqzaizjjycdivbgwclq`
- Status retornado pela integração em 2026-10-25: `INACTIVE`
- Natureza: referência histórica, **não** banco de produção do Jarvis.

## Regras para o Jarvis
1. Manter este registro como índice de referência, com data e origem.
2. Quando houver pergunta sobre migração, comparar este registro a commits, migrações, documentação e logs efetivamente disponíveis.
3. Distinguir claramente fatos verificados de relatos e hipóteses; não inventar estrutura, causas, destino nem cronologia.
4. Se o Supabase legado estiver inacessível, explicar a limitação. Não tentar reativar, executar SQL, exportar dados, migrar ou alterar cobrança automaticamente.
5. Futuramente, conectar metadados e documentação **somente leitura**, quando houver autorização e serviço acessível. Nunca duplicar banco integralmente na memória do Jarvis.
6. Evitar guardar credenciais, registros pessoais e dumps. Priorizar referências a documentos, commits, modelos de dados e decisões.
7. Separar o projeto legado da futura persistência mínima de identidade/sessões do Jarvis.

## Pendências históricas
- Identificar onde está atualmente a base funcional do Sistema Origem.
- Localizar commits e migrações que registram a transição, se existirem.
- Levantar o que foi mantido, removido e alterado, com evidências.
- Definir se há acesso histórico disponível ao Supabase inativo sem reativação e sem riscos.

Este arquivo não estabelece integração técnica nem atesta que os dados antigos continuam recuperáveis.
