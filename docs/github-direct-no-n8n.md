# Jarvis Kiro — gravação GitHub sem n8n e sem Windows

## Objetivo

Criar arquivos, pastas, branches, commits e PRs GitHub a partir da conversa com Jarvis Kiro sem contratar uma nova hospedagem para n8n.

## Fluxo

1. O usuário solicita uma ação em linguagem natural.
2. O núcleo Jarvis detecta a intenção, seleciona somente recursos GitHub autorizados e prepara um plano com branch + commit + PR.
3. A autorização verbal ou por texto é validada na sessão autenticada.
4. Quando `JARVIS_GITHUB_EXECUTION_MODE=direct` **e** `VERCEL_ENV=preview`, o mesmo conector GitHub executa diretamente na função já hospedada na Vercel.
5. O Jarvis retorna commit e URL real do PR somente após o plano ser concluído com sucesso. Não faz merge nem altera a branch principal.
6. Se a operação for parcial, incerta ou falhar, orienta consultar o estado antes de repetir.

## Configuração

- Vercel Preview: `JARVIS_GITHUB_EXECUTION_MODE=direct` (não exige nova credencial; usa a credencial GitHub autorizada já armazenada no cofre).
- Production: a variável não foi criada, portanto não executa pelo modo direto.
- Pré-produção estável: `https://jarvis-kiro-preproducao.vercel.app`.
- O modo antigo com n8n continua disponível quando a variável não for `direct`.

## Cuidados

A primeira escrita real ainda precisa de validação com uma única solicitação aprovada e confirmação do PR real. O build Vercel não prova permissão efetiva da instalação GitHub nem o resultado de mutações. O serviço tem limites de tempo por requisição e pode falhar em alterações grandes. Nunca repetir automaticamente operações de estado incerto. O n8n continua útil para tarefas locais e workflows longos, mas não é necessário para esta operação GitHub.
