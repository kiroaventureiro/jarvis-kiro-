# Jarvis Kiro

Assistente pessoal Kiro Produções, com interface Next.js para desktop e iPhone.

## Usar os aplicativos

Na branch experimental, o botão **Aplicativos** abre atalhos para Codex, ChatGPT,
Google, Microsoft 365, GitHub, Supabase e Vercel. Experimente “peça ao Codex para
revisar meus testes”, “pergunte ao Navi sobre minha ideia” ou “pesquise no Google
sobre energia solar”. O Jarvis prepara o pedido/link; você abre e envia no destino.
Esses atalhos não concedem acesso às contas nem controle remoto do navegador.

Na Central de Conexões, Google/Microsoft têm seleção de serviços e fluxo OAuth
de leitura de metadados, bloqueado até o cadastro administrativo dos aplicativos.
A câmera usa permissão local do navegador. Os cartões priorizam Kiro/Grok/OBS e
informam os requisitos das integrações ainda pendentes.
[Estado das conexões e configuração necessária](docs/CONNECTIONS-READINESS.md).

**OBS / Kiro TV:** a Central de Conexões consulta cenas e estado de transmissão/
gravação pelo WebSocket autenticado do OBS no mesmo aparelho, sem instalar agente.
Requer permissão de acesso local no navegador e não inicia lives nem gravações.
[Como conectar o OBS](docs/OBS-LOCAL-CONNECTION.md).

Para acesso do próprio Jarvis aos serviços, use **Conexões** e os conectores
autenticados. **Verificar Abacus e contas já autorizadas** consulta o catálogo
Abacus, GitHub, Supabase, Vercel e a descoberta VoiceStudio em uma ação,
usando apenas a configuração já guardada. Não altera permissões, não inicia
execuções nem gera conteúdo pago. A leitura do catálogo Abacus não comprova
geração nem acesso aos conectores privados do ChatLLM.
Para ouvir e ajustar a voz disponível no aparelho, use
**Configurações → Identidade vocal do Jarvis**. VoiceStudio externo é opcional e
exige serviço próprio configurado. [Demonstração e limites](docs/CODEX-APP-HANDOFF.md).

[Diagnóstico e limites da integração Jarvis ↔ Codex Cloud](docs/CODEX-CLOUD-INTEGRATION.md)

[Autonomia, autocorreção e rotina de manutenção](docs/AUTONOMY-AND-MAINTENANCE.md).
Execute `npm run maintenance:check` para gerar o relatório local de vulnerabilidades,
testes e tipos. Isso não ativa agendamento, alterações automáticas de código ou
atualização diária de leis.

## Estado verificado (29/10/2026)

- Interface, arquivos, projeções e fluxos locais possuem testes automatizados; contas e dispositivos reais exigem validação própria.
- GitHub, Supabase e Vercel possuem conectores nativos com sessão, cofre e permissões. A implementação não comprova autorização de cada conta.
- Google/Microsoft possuem OAuth e leitura de metadados; o cadastro dos aplicativos e o consentimento continuam necessários.
- Voz Realtime depende de credencial e orçamento; VoiceStudio depende de um serviço externo. Não foram acionados serviços pagos nesta revisão.
- Codex/ChatGPT possuem abertura assistida com pedido preparado; isso não é execução autônoma no Codex Cloud.
- Redes sociais, bancos e os demais itens do catálogo têm estados e requisitos próprios. Catálogo não significa conexão ativa.

O relatório de auditoria reúne os resultados, limites e pendências em [docs/AUDIT-2026-10-29.md](docs/AUDIT-2026-10-29.md).

[Arquitetura de evolução](docs/ARCHITECTURE.md) · [Migração de banco](supabase/migrations/20261025_jarvis_foundation.sql)

Nunca coloque segredos no GitHub nem desative a autenticação da API de voz para contornar erros 401.
