# Jarvis Companion — Windows e extensões de navegador

O site Jarvis Kiro permanece o centro da experiência. Uma futura extensão de Chrome/Edge e um aplicativo Windows poderão receber comandos do Jarvis mediante autorização expressa.

## Estado real
- Interface web e comandos locais: implementados parcialmente na branch experimental.
- Extensão Chrome/Edge: **não instalada nem publicada**.
- Aplicativo Windows: **não distribuído nem conectado**.
- Acesso autônomo a arquivos e aplicativos: **indisponível**.
- Execução Codex remota: **não conectada**.
- Navi/OpenAI API: rota de servidor existente, mas exige configuração e autorização de cobrança independente.

## Modelo de execução proposto
1. Jarvis entende a solicitação e a intenção.
2. A função declara capacidade, destino, impacto e permissões necessárias.
3. Para ações sensíveis, Jarvis solicita confirmação por voz ou escrita.
4. Um companion autenticado recebe uma requisição curta, com identificador único, expiração, escopo e comprovante de aprovação.
5. O companion valida origem, sessão, autorização, proteção contra repetição e capacidade autorizada.
6. A execução retorna status verdadeiro e evidências; erros não são apresentados como sucesso.

O contrato inicial em `lib/companion/contract.ts` apenas valida a forma da solicitação, **não** concede poderes ao sistema operacional nem constitui uma conexão segura pronta. Antes de conectar um aplicativo real, adicionar autenticação de dispositivo, isolamento de permissões, nonce durável, confirmação vinculada aos parâmetros e canal auditado de resultados.

## Escuta por voz
O navegador pode interromper a escuta quando a página fica oculta, fechada ou suspensa. Presença contínua no Windows exige app local inicializado com consentimento, indicador de microfone e controle de desligamento. Não ativar gravação permanente silenciosamente.

## Experiência
Tela principal limpa com Jarvis como elemento central. Barra de ferramentas aparece ao aproximar mouse na borda inferior (desktop). Comandos naturais de volume e interface são executados localmente quando suportados. Não remover formas acessíveis de recuperar a navegação.
