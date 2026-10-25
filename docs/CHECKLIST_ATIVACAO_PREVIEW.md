# Checklist de ativação — Jarvis Kiro (computador)

**Objetivo:** preparar o ambiente Preview da branch `feature/diretor-tecnico-agent` sem publicar em produção.

## 1. Antes das credenciais
- [ ] Conferir GitHub Actions aprovado para o último commit.
- [ ] Conferir na Vercel o projeto `jarvis-kiro` e a branch de Preview correta.
- [ ] Verificar os nomes das variáveis já existentes; não sobrescrever segredos sem validar o destino.
- [ ] Manter acesso restrito a Preview. **Nunca** mandar chaves pelo chat, screenshots, GitHub ou código-fonte.

## 2. GitHub — somente leitura
- [ ] Criar credencial fine-grained no GitHub para os repositórios necessários; usar permissões mínimas de leitura para metadados/issues (e conteúdo somente se necessário).
- [ ] Cadastrar na Vercel, Settings > Environment Variables: `GITHUB_READ_TOKEN` = credencial de leitura, ambiente Preview e branch `feature/diretor-tecnico-agent`.
- [ ] Fazer novo deploy Preview e testar com sessão autorizada `/api/director/project-status?repo=jarvis-kiro-`. Esperar `source: github_live`. Sem credencial deve retornar 503.
- [ ] Não conceder permissões de escrita, organização inteira ou acesso não necessário.

## 3. Voz — servidor
- [ ] Obter chave de API válida em conta/plataforma OpenAI apropriada e confirmar orçamento/limites de uso (API pode ter cobrança independente da assinatura ChatGPT).
- [ ] Na Vercel Preview, definir `OPENAI_API_KEY` apenas no servidor; não usar `NEXT_PUBLIC_`.
- [ ] Novo deploy Preview. Com sessão autorizada, testar no Safari do iPhone e no Edge/Chrome do Windows. Microfone exige permissão/HTTPS.
- [ ] Voz em português, memória curada, encerramento do microfone e negativa de acessos inexistentes.
- [ ] Não confundir êxito no build com voz testada de ponta a ponta.

## 4. Supabase (adiado)
- [ ] Não colocar chave `sb_secret_` no navegador nem conversa.
- [ ] Na etapa posterior, validar nome esperado pelo código e configurar segredo no Preview, jamais em produção antes de testes.
- [ ] Não habilitar passkeys até uma bateria de testes reais.

## 5. Aceite e evidências
- [ ] Testes automatizados e Preview apontam ao mesmo SHA e estão aprovados.
- [ ] Sessões não autorizadas recebem 401; indisponibilidade de configuração é explícita.
- [ ] GitHub real responde apenas com dados de leitura.
- [ ] Conversa real funciona em ambos os dispositivos e o áudio é liberado ao encerrar.
- [ ] Histórico de memória é identificado como curado e não consulta em tempo real.
- [ ] Registrar resultados sem dados sensíveis no documento `docs/VALIDACAO_IPHONE_WINDOWS_VOZ_MEMORIA.md`.

**Estado:** checklist pronto; nenhuma variável ou credencial foi configurada por este documento.
