# Correção: voz única, demonstrações complementares e Abacus na voz neural

## Problemas reproduzidos

O roteiro compartilhado acrescentava ao texto da resposta os títulos e explicações dos quadros. Isso podia falar a mesma frase como título, resumo e conteúdo. A síntese genérica do HUD também projetava trechos do próprio texto falado. A ferramenta operacional usada pela voz neural recebia somente o estado genérico da conexão Abacus; não incluía catálogo e observação da conta importada.

## Correções

- A narração usa o texto da resposta como fonte autoritativa, sem ler automaticamente títulos, rótulos ou descrições dos quadros.
- Cada frase é distribuída uma vez entre as etapas visuais. Não há duas sínteses concorrentes durante mudança de etapa ou redimensionamento.
- O controle mantém as frases concluídas e cobre trechos pendentes ao finalizar, sem perder a explicação por mudança de layout.
- Em computador, a projeção complementar remove texto e parágrafos que espelham a narração. O corpo de relatórios deixa de ser usado como transcrição automática.
- Gráficos, mapas, imagens, links de fontes e informações complementares permanecem. Sem demonstração independente, a resposta pode ser apenas falada.
- O título de um ponto fica no título; o corpo mostra seu detalhe, sem repetir o rótulo.
- A fala completa permanece disponível para exportação e leitura solicitada ou fallback. O comportamento de transcrição no mobile é preservado.
- Eventos de texto da sessão neural são tratados como resposta falada enquanto o áudio estiver disponível. Eventos mistos não expõem a transcrição no desktop.
- A rota operacional autenticada inclui o campo abacus, com catálogo consultado, contagem de modelos/ferramentas, observação privada datada e limites do que está implementado.
- O envio à voz neural preserva os fatos do catálogo, mas remove a observação privada de plano, saldo, Gmail, tarefas e agentes quando o turno não for uma pergunta explícita sobre a conta Abacus ou o controle local estiver desligado. O HUD local pode consultar a observação autenticada. Não se confunde orçamento local com saldo de créditos.
- A demonstração de Abacus mostra metadados compactos; a resposta completa é anexada somente para leitura opcional, exportação e fallback.

## Segurança e compatibilidade

Autenticação, cofre criptografado, restrições de escrita e orçamento continuam existentes. A consulta dos catálogos não executa modelos. Não foram adicionados serviços pagos, chaves ou geração automática de vídeo/agentes.

## Validação

tests/voice-complement.test.mjs cobre o exemplo relatado, fala sem títulos, remoção de espelhos textuais, preservação de evidência visual, detalhes sem rótulo duplicado, concorrência e evidência Abacus no tool output.
tests/browser/voice-complement-smoke.cjs exercita desktop com áudio simulado, fallback, ferramenta real da rota operacional e RTC simulado. Não é teste acústico de microfone físico nem execução paga de uma sessão neural.

## Nova sessão

Sessões neurais já abertas retêm as instruções com que foram criadas. A versão corrigida precisa ser carregada e a conversa neural iniciada novamente. O endereço estável do Preview da branch pode ser usado para as próximas atualizações, sem alterar produção.

## Compartilhamento privado

A tentativa de incluir a observação privada nas instruções iniciais enviadas à OpenAI foi rejeitada pela revisão automática por falta de autorização explícita para o payload e destino. Essa alteração não foi aplicada. Respostas indiretas da ferramenta de pesquisa também passam pela seleção de campos e pelo escopo de autorização do turno.

## Autorização específica recebida

O proprietário aprovou a opção 1: encaminhar à OpenAI somente ao perguntar sobre sua conta Abacus os campos plano, saldo e data observados, serviços cadastrados como Gmail, tarefas e agentes. A seleção exclui qualquer campo extra. A Central oferece desligamento imediato por navegador. Nenhuma observação privada é anexada ao início de sessão. A tentativa inicial de preload permaneceu descartada.

## Resultados desta correção
378 testes Node passaram. TypeScript validado pelo build Next.js de produção. Os dez cenários novos de navegador passaram, incluindo voz única, falha de áudio, transcrição oculta e entrega seletiva da observação. Os cenários usam fixtures e RTC simulado, sem teste pago de geração ou captura física de microfone.
