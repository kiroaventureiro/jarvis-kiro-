# Jarvis Kiro — Visão Unificada Google, Microsoft e Dispositivos (projeto)

## Objetivo
Uma visão integrada da pessoa e da Kiro Produções para orientar metas, orçamento, investimento, tempo, comunicação, qualidade visual das produções e engenharia de software. **Separação por domínio não impede relatórios consolidados**: a consolidação é consultiva e sob permissão explícita, com origem e caráter pessoal/profissional identificados por item.

## Conexões por categoria (não pressupor acesso por login genérico)
| Origem | Consulta desejada | Como habilitar | Limites |
|---|---|---|---|
| Google Drive | Docs, planilhas, imagens, PDFs, metadados e pastas selecionadas | conector autorizado / Google Drive API com OAuth | sem cópias integrais persistentes |
| Gmail | mensagens, compromissos, despesas e solicitações | conector Gmail / Gmail API por escopos | rascunhos inicialmente; envio com confirmação |
| Google Calendar | eventos, disponibilidade, agenda | conectar calendário com OAuth | modificações e convites autorizados |
| Google Maps | locais e rotas por consulta | Maps APIs e recursos disponibilizados ao usuário | login Google não dá API universal ao histórico de lugares |
| Histórico de localização | somente se houver exportação voluntária e formato suportado | fluxo de importação local autorizado, se oferecido | não presumir acesso pela conta Google |
| Microsoft Outlook | mensagens e calendário | Outlook Email/Calendar ou Microsoft Graph OAuth | permissões separadas do Google |
| OneDrive | fotos, vídeos, documentos e diretórios selecionados | Microsoft Graph / conector compatível, consentimento | não indexar acervo completo sem objetivo específico |
| Windows | diretórios, apps e ações específicos | agente local assinado, emparelhado, permissões por pasta/ação | não habilitar controle remoto irrestrito |
| iPhone | voz, painel, alertas e arquivos escolhidos | PWA/app + permissões do iOS | sem controle universal de apps, arquivos, navegador ou áudio permanente |
| Histórico de navegador | páginas explicitamente selecionadas e favoritas exportadas | extensão opt-in ou importação local | sem captura de senhas/cookies/sessões |

## Duas dimensões + síntese opcional
- `scope=personal`: dados pessoais.
- `scope=kiro`: projetos e operação da Kiro.
- `scope=combined`: planejamento agregado: metas, capacidade de tempo, disponibilidade de caixa e possíveis conflitos. Todo dado citado informa escopo, fonte e data; nunca misturar contas ou transferir dados entre elas automaticamente.
- Classificação inicial por conta/pasta; ambiguidades são apresentadas para correção. Consentimento configurável e revogável por origem.

## Análise visual e consistência de personagens
Indexar **somente referências selecionadas** (personagem, obra, versão, roupa, cores, atributos, local de origem e hash). Analisar imagens sob demanda, comparar com a ficha canônica e registrar divergências para revisão; não copiar toda a biblioteca do OneDrive. Reconhecimento de identidade de pessoas reais não é requisito da gestão de personagens; identidade pessoal é fornecida voluntariamente pelo usuário, não inferida por reconhecimento facial.

## Motor de metas e investimentos
Cada projeção combina valor inicial, fluxo de caixa, custos, orçamento disponível, horas úteis, indicadores atuais, hipóteses, fontes datadas, cenários pessimista/base/otimista, prazos e sensibilidade. Fatos observados separados de estimativas. Propostas de investimento exigem análise de risco, liquidez e horizonte; nenhum investimento, compra ou transferência executado sem aprovação explícita.

## Implementação incremental
1. Passkeys e sessão confiável desktop/iPhone; proteção de API.
2. Inventário de conectores e aprovação granular, inicialmente somente leitura.
3. Conectar Drive + Gmail + Calendar em contas autorizadas, sem varredura irrestrita; validar escopos e limites.
4. Outlook + OneDrive por conector compatível ou Graph.
5. Classificador personal/kiro e painel consolidado com dados referenciados.
6. Arquivos visuais canônicos e auditoria de consistência dos personagens.
7. Agente Windows opt-in e integrações iPhone conforme plataforma permitir.
8. Métricas, cenários e recomendações financeiras sem movimentações automáticas.

## Segurança e custo
A IA não recebe senha Google/Microsoft nem tokens de sessão em prompts. Tokens OAuth cifrados e guardados no backend/cofre, não em GitHub, logs ou navegador. Permissões por escopo e pasta quando disponíveis; aprovação para escrita, envio, publicação, pagamento e ações destrutivas. Minimizar requisições, usar cache temporário, evitar coletar tudo; manter só IDs, metadados de origem, decisões e resumos indispensáveis.

## Status desta entrega
Especificação arquitetural; **nenhum serviço Google/Microsoft adicional foi conectado ao Jarvis Kiro nem foi concedido acesso ao Windows/iPhone**. Conectores disponíveis nesta conversa não transferem por si só sua autorização ou seus dados para o aplicativo Jarvis.
