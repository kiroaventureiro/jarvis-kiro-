# Jarvis — resultados unificados de Navi, Codex e ferramentas de mídia

## Objetivo do proprietário
O usuário conversa naturalmente com Jarvis. Jarvis identifica o pedido e a ferramenta conectada e autorizada, acompanha a operação e devolve a resposta **no próprio Jarvis**. Esta especificação complementa, sem substituir, a implementação da ponte Codex, segurança, persistência e aprovação já em curso.

## Contrato de retorno (proposta, ainda não implementada)
- `requestId`: identificador da solicitação;
- `source`: `navi` | `codex` | `image` | `other`;
- `status`: `draft` | `needs_authorization` | `queued` | `running` | `completed` | `failed`;
- `messages`: respostas textuais e explicações visíveis no chat;
- `artifacts`: itens com `type` (`image`, `document`, `video`, `code`, `report`), `mimeType`, `name`, `storageKey` e `previewUrl` gerado pelo backend;
- `actions`: links autenticados para abrir, visualizar e baixar;
- `provenance`: serviço executor, referência de tarefa e evidências reais de conclusão.

## Requisitos
1. A interação começa e termina na interface do Jarvis: chat, voz, cards de imagem, arquivos e links a resultados.
2. O roteador interpreta linguagem natural, identifica escopo/projeto e usa recursos conectados e autorizados; perguntas e negativas não disparam execução.
3. Respostas de Navi e Codex podem ser exibidas no mesmo histórico; não pressupor que ChatGPT pessoal seja invocável diretamente via API.
4. Imagens, documentos e vídeos exigem geração/edição em provedor habilitado e entrega segura de arquivos; não fingir que Codex ou modelo textual produziu mídia sem ferramenta de mídia operante.
5. Arquivos privados em armazenamento próprio: URLs temporárias, controle de acesso, limites de tamanho, varredura/validação de tipos e exclusão/retencão documentada. Nenhum segredo enviado ao cliente.
6. Distinguir `planejado`, `aguardando autorização`, `executando` e `concluído`. Cada resultado requer prova de execução.
7. Consultar permissões, disponibilidade e modalidades de custo dos provedores. Assinatura ChatGPT/Codex não equivale a crédito de API OpenAI; cobrança nova exige consentimento.
8. Caso integração indisponível, apresentar a limitação com precisão e oferecer rotas alternativas autorizadas, sem bloquear recursos existentes.
9. Preservar produção e seguir trabalho incremental na branch experimental.

## Sequência de integração
- Confirmar testes da ponte Codex e sua aprovação vinculada à tarefa.
- Implementar fila de execução, autenticação do executor isolado e canal assinado de resultados.
- Estabelecer formato unificado de respostas/artefatos (texto e imagens) e armazenamento seguro.
- Integrar visualização no chat/holograma Jarvis, testes de ponta a ponta e validação com provedor real.

**Estado em 2026-10-29:** especificação adicionada; nenhum novo executor, gerador de imagens ou integração de assinatura pessoal foi conectado por este documento.
