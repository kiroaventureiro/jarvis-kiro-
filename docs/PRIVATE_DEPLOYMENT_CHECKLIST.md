# Configuração privada — Jarvis Kiro (não produção)
Data: 2026-10-25

## Ambiente verificado
- Supabase dedicado: `jarvis-kiro` (`unwrssdhmzaizilwsuuf`).
- Vercel: projeto `jarvis-kiro`. `SUPABASE_URL` configurada em Preview e Development.
- Flags `JARVIS_PASSKEY_LOGIN_ENABLED` e `JARVIS_PASSKEY_ENROLLMENT_ENABLED`: `false`.
- As rotas de passkey **não estão liberadas**.
- Integração Supabase disponível aqui expõe chaves publicáveis, **não** a credencial privilegiada. Não é seguro substituir a service-role por uma chave pública.

## Configuração privada pendente
1. No dashboard **do Supabase dedicado**: https://supabase.com/dashboard/project/unwrssdhmzaizilwsuuf/settings/api-keys
   - Obter a credencial de servidor apropriada para as rotas administrativas do Jarvis (service_role ou secret key compatível).
   - Nunca colocar essa credencial em chat, GitHub, arquivo .env versionado ou no cliente.
2. Na Vercel do projeto Jarvis: https://vercel.com/dashboard (selecionar `jarvis-kiro` > Settings > Environment Variables)
   - Salvar como variável **Sensitive/Encrypted** `SUPABASE_SERVICE_ROLE_KEY` em **Preview** limitado à branch `feature/diretor-tecnico-agent` e, se necessário, em Development seguro. **Não** marcar Production.
   - Confirmar o formato exato da credencial compatível com as chamadas REST antes da ativação. Fazer rotação imediata se for exposta.
3. Definir `JARVIS_WEBAUTHN_ORIGIN` e `JARVIS_WEBAUTHN_RP_ID` de acordo com a URL HTTPS **estável** do ambiente de testes (uma origem exata e RP ID correto). Evitar subdomínios de preview que mudam a cada deploy.
4. Configurar `JARVIS_SESSION_SECRET` com entropia forte e `JARVIS_ACCESS_PASSWORD` com senha longa **apenas em ambiente seguro**; considerar migração futura para sessão persistente revogável.
5. Validar autorização de proprietário e proteção contra CSRF; taxa de tentativas; consumo atômico de challenges; controle de contadores em passkeys sincronizadas; verificar fluxo E2E com autenticador virtual.
6. Somente após testes concluídos, habilitar cadastro restrito, registrar dispositivo confiável, desligar cadastro e habilitar login. Verificar iPhone e Windows presencialmente.

## Critérios de liberação
- CI, TypeScript e build verdes na última revisão.
- Banco dedicado, credenciais e RP ID configurados corretamente.
- E2E WebAuthn com challenge inválido, vencido, reutilizado e assinatura inválida rejeitados.
- Não permitir cadastro anônimo ou ativação direta sem uma sessão já autenticada.
- Não tocar no banco legado do Sistema Origem.
- Não publicar antes da revisão humana do PR e confirmação dos testes em ambos os dispositivos.

Nenhum segredo está neste documento; a existência deste guia não significa que a credencial ou os testes já estejam configurados.
