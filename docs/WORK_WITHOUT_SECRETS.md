# Jarvis Kiro — Desenvolvimento sem credenciais
Atualizado em 2026-10-25.

## Decisão
O proprietário relatou dificuldade em copiar a chave secreta no celular e solicitou continuar a estrutura do projeto, adiando a conexão privada com a Vercel. **Não insistir nessa configuração agora.**

## Situação confirmada
- Supabase dedicado `jarvis-kiro` criado; tabelas `jarvis_passkeys` e `jarvis_webauthn_challenges` aplicadas.
- Endereço público `SUPABASE_URL` configurado em Preview/Development da Vercel.
- A credencial `SUPABASE_SERVICE_ROLE_KEY` **não está confirmada** na Vercel.
- Flags de cadastro e login por passkey continuam desativadas.
- Pull request em rascunho: https://github.com/kiroaventureiro/jarvis-kiro-/pull/1
- Testes CI iniciais passaram. **Não há comprovação de WebAuthn E2E real ou testes físicos**.

## Trabalhos independentes da chave
1. Testar a lógica de geração e expiração de desafios com banco simulado.
2. Adicionar limite de frequência e rejeição de payloads anormais em registro/login.
3. Implementar autenticação de bootstrap restrita ao proprietário e expiração de sessão; revisar prevenção de CSRF.
4. Construir diagnósticos que apenas sinalizem configuração ausente sem revelar segredos.
5. Testar o painel e a voz com mocks controlados, sem considerar a integração real validada.
6. Documentar os conectores e permissões mínimas (GitHub, Vercel, Supabase, Google/Microsoft), sem acessar automaticamente dados privados nem executar ações destrutivas.
7. Manter todas as mudanças na branch de desenvolvimento e não ativar produção.

## Retomada da conexão privada, em outro momento
- Fazer pelo computador, em Vercel > projeto `jarvis-kiro` > Settings > Environment Variables.
- Criar uma variável **sensitive** `SUPABASE_SERVICE_ROLE_KEY` com o valor `sb_secret_` obtido do **Supabase dedicado**, somente Preview e a branch de desenvolvimento.
- Não compartilhar chave, captura de chave revelada ou arquivo .env em conversas e GitHub.
- Após configurar, confirmar sem ler/revelar o valor; gerar preview de teste, executar verificações reais, e somente então decidir sobre habilitar cadastro temporário.
