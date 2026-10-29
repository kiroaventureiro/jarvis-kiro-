# Humanizer no JK

Orientações adaptadas de [blader/humanizer](https://github.com/blader/humanizer/tree/0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0), skill 3.1.0, licença MIT. Aviso em licenses/humanizer.txt.

O protocolo cognitivo inclui uma política curta em português na geração de respostas da Abacus, síntese de pesquisa e instruções da sessão OpenAI de voz. A classificação de intenções mantém seu contrato sem esse conteúdo editorial. A skill completa fica no Codex; o JK utiliza a adaptação em lib/cognitive/humanizer.ts.

O usuário pode pedir “Humanize este texto, mantendo os fatos e as referências”. O caminho de conversação existente atende esse pedido e recebe as orientações na mesma chamada. Não há novo provedor, segunda chamada de revisão ou alteração de modelo. A instrução adicional aumenta o contexto de entrada; não se promete custo zero. Reservas e limites existentes continuam aplicáveis.

A política reduz repetições, frases prontas, superlativos e formatação decorativa. Preserva evidências, ressalvas, nomes, números e citações; não modifica código ou JSON por substituições automáticas. Não concede permissões, não simula identidade humana nem promete enganar detectores de IA.

A preferência desktop por voz e demonstrações complementares permanece no fluxo de apresentação existente. Esta mudança orienta a linguagem; não corrige, por si só, eventos duplicados de transporte, áudio ou HUD. Respostas determinísticas de conectores não são reescritas automaticamente, para preservar seus dados e evitar chamadas adicionais.

Validação automatizada: presença da política no plano real de conversa e na configuração de voz, isolamento do classificador, preservação literal do pedido e parâmetros de orçamento. Esses testes comprovam o contrato enviado, não a qualidade subjetiva de toda resposta de um modelo. Nenhuma chamada paga é necessária aos testes.
