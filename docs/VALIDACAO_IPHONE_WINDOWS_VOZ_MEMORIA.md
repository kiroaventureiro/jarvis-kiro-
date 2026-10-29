# Jarvis Kiro — Roteiro de validação iPhone e Windows

**Ambiente:** Preview da branch `feature/diretor-tecnico-agent`. Não publicar em produção até todos os critérios de aceite passarem.

## Antes de iniciar
- Confirmar Preview READY na Vercel e GitHub Actions verde para o mesmo SHA.
- Variáveis de ambiente exclusivamente no servidor e Preview: `OPENAI_API_KEY` para voz; `GITHUB_READ_TOKEN` com escopo mínimo de leitura para consultas GitHub. Não colar chaves no chat, GitHub ou navegador.
- Verificar autorização da sessão conforme implementação existente. Não contornar o login nem habilitar passkeys antes de validação real.
- Sem variável: esperar resposta de indisponibilidade, nunca falsa confirmação de conexão.
- Microfone permitido somente durante teste; usar HTTPS, iPhone Safari e Windows Edge/Chrome.

## iPhone (Safari)
1. Abrir o URL Preview da branch no Safari; conferir layout responsivo, textos e controles.
2. Sem sessão autorizada, acionar voz: esperar 401 e nenhuma sessão.
3. Com sessão válida e chave de voz configurada, tocar **Conversar por voz**, autorizar microfone, dizer “Jarvis, quem é você e como trabalha?”; confirmar áudio inteligível em português brasileiro.
4. Perguntar “O que decidimos sobre o Supabase do Jarvis?”; verificar resposta limitada à memória curada e fonte, sem alegar sincronização ao vivo.
5. Perguntar “Consulte agora meu GitHub e altere o projeto”: sem ferramenta de GitHub na sessão de voz, Jarvis deve reconhecer limitação e não declarar alteração.
6. Encerrar conversa, observar microfone desligado e ausência de áudio residual. Negar permissão ao microfone e verificar erro claro, sem travamento.

## Windows (Edge ou Chrome)
1. Abrir a mesma Preview; conferir layout e acesso.
2. Repetir voz e memória com headset ou microfone do computador; checar início, áudio, interrupção e encerramento.
3. Repetir teste de negação de microfone e atualização da página.
4. Comparar respostas de limites de acesso com o iPhone.

## Consulta GitHub separada da voz
- Sem sessão, GET `/api/director/project-status?repo=jarvis-kiro-` → 401.
- Com sessão, sem `GITHUB_READ_TOKEN` → 503, conexão não configurada.
- Com sessão e token de leitura válido → metadados reais com `source: github_live`, `fetchedAt`, sem revelar token.
- Parâmetro `repo` inválido → 400. Nenhuma operação de escrita.
- Busca de issues: GET `/api/director/project-search?repo=jarvis-kiro-&q=passkey` com sessão e token; confirmar dados atuais separados de `curatedMemory`.

## Critérios de aceite
- [ ] CI para o SHA testado aprovado.
- [ ] Preview da mesma revisão READY.
- [ ] Autenticação autorizada sem bypass.
- [ ] Voz real testada em iPhone.
- [ ] Voz real testada em Windows.
- [ ] Memória real testada e fontes distinguíveis.
- [ ] Falhas de rede, microfone e credenciais tratadas claramente.
- [ ] GitHub leitura real testada sem acesso de escrita.
- [ ] Nenhuma credencial exposta e nenhuma mudança em produção.

## Registro de evidências
Para cada teste guardar: dispositivo, navegador, SHA/deploy Preview, data, PASS/FAIL, mensagem de erro sem segredos. Não marcar como aprovado somente porque código compilou ou Preview está READY.

**Estado deste documento:** roteiro preparado, não prova de execução real.
