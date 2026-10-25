# Jarvis Kiro — Gate de lançamento (iPhone + Windows)

Status: **BLOQUEADO**. Só declarar pronto depois de todos os testes verificados com evidência.

## Pré-requisitos
- Backend implementa registro WebAuthn com sessão do dono; sem enrollment público.
- Login verifica assinatura, challenge de uso único, RP ID, origem, expiração, credencial não revogada e contador quando aplicável.
- Segredos nunca vão ao navegador; cookies Secure, HttpOnly, SameSite e rotação/revogação de sessão.
- Migrações em Supabase dedicado, política de acesso e testes de integração de banco.
- Configuração HTTPS e domínio de produção verificados.

## Matriz de teste (cada linha: iPhone Safari e Windows Chrome/Edge)
| Caso | Resultado esperado | Estado |
|---|---|---|
| Cadastrar primeira passkey pelo fluxo de bootstrap protegido | senha do aparelho/biometria solicitada, credencial armazenada | Pendente |
| Entrar novamente | autentica e cria sessão | Pendente |
| Fechar/abrir app | sessão válida segundo política de expiração | Pendente |
| Dispositivo não cadastrado | não acessa APIs privadas | Pendente |
| Reutilizar challenge | 401 e bloqueio de replay | Pendente |
| Origem ou RP ID divergente | rejeitado | Pendente |
| Passkey revogada | login negado | Pendente |
| Sessão expirada | 401 | Pendente |
| GitHub privado sem sessão | 401, sem vazamento | Pendente |
| GitHub privado autorizado | inventário filtrado com leitura mínima | Pendente |
| Voz sem sessão | negada; nunca emite token Realtime | Pendente |
| Voz com sessão | microfone e resposta verificáveis | Pendente |
| Falha de Supabase | erro controlado, sem bypass | Pendente |
| Consentimento e logs | dados pessoais não aparecem em logs | Pendente |

## Evidências necessárias
- CI verde: testes unitários, TypeScript, build e secret scan.
- Teste de integração WebAuthn com autenticador virtual (browser automation) e banco de teste.
- E2E em navegador móvel simulado e desktop.
- Testes em aparelhos reais: Safari iPhone + Windows em HTTPS com passkeys nativas e microfone.
- Repositórios existentes: sem deploy ou modificações involuntárias.
- Aprovação explícita antes de merge e publicação.

## Situação em 25/10/2026
- Schema passkeys criado em branch, **mas verificação criptográfica e UI ainda não implementadas**.
- Testes estáticos de segurança e workflow CI foram adicionados à branch; **resultado de execução ainda não confirmado**.
- Testes de dispositivos **não executados**; GitHub inventory **apenas descoberto**.
- Não solicitar utilização do Jarvis como se estivesse pronto.
