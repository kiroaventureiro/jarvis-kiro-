# Conexões do Jarvis — entrega experimental de 29/10/2026

A interface fica em `/conexoes`, na branch `feature/diretor-tecnico-agent`.
O catálogo passou de 188 entradas (uma OpenArt repetida) para 200 serviços únicos,
com inclusões Google/Microsoft/câmera. Cada cartão apresenta prioridade, ação real
implementada ou bloqueio. Não foram criadas 200 integrações executáveis.

## Sem novas contas

- Crossref, Open Library, Banco Central e Wikipedia: consultas reais realizadas
  neste ambiente, HTTP 200 e JSON válido nos quatro serviços. São fontes públicas
  já integradas, sem autorização de conta; não dão acesso a dados privados.
- Câmera: interface funcional no navegador com permissão explícita, prévia,
  captura de foto e download local. Não captura áudio, grava vídeo ou envia mídia.
  Encerra os tracks ao desligar, sair da página ou ocultá-la. Testes usaram câmera
  simulada; a permissão e o hardware real do proprietário não foram acessados.
- Skills locais existentes continuam independentes de contas externas.

## Google e Microsoft: implementação entregue

A interface permite selecionar serviços, iniciar o consentimento oficial, voltar
pelo callback, guardar tokens somente no cofre criptografado existente, renovar
acesso quando necessário, listar até cinco metadados e remover a autorização local.
O retorno de dados é identificado como externo. Nenhum conteúdo vira instrução.
A conversa Jarvis reutiliza os mesmos adaptadores: “liste meus arquivos no Drive”,
“quais mensagens no Gmail” e “mostre as agendas da Microsoft” fazem leitura local
roteada, sem chamada a um modelo pago. Pedidos de escrita retornam o limite da versão.

| Serviço | Escopo inicial e operação implementada |
| --- | --- |
| Gmail | `gmail.metadata`: listar IDs e assuntos de até cinco mensagens, sem corpo ou envio |
| Google Drive | `drive.metadata.readonly`: listar nomes e tipos de arquivos |
| Docs/Sheets/Slides | A mesma listagem Drive; não lê nem edita conteúdo |
| Google Agenda | `calendar.calendarlist.readonly`: listar agendas, sem eventos |
| Google Contatos | `contacts.readonly`: listar metadados de contatos |
| YouTube / Kiro TV | `youtube.readonly`: consultar os canais da conta, sem publicar |
| Outlook | `Mail.ReadBasic`: listar metadados básicos de mensagens |
| Microsoft Agenda | `Calendars.ReadBasic`: listar agendas |
| OneDrive / Word / Excel / PowerPoint | `Files.Read`: listar arquivos, sem editar conteúdo |
| Microsoft Contatos | `Contacts.Read`: listar metadados de contatos |

Google Fotos, Meet, Tasks, Forms, Teams, To Do e SharePoint estão no catálogo, mas
não herdam as capacidades acima. Dependem de adaptadores, escopos e políticas
específicos; a interface não mostra consentimento pronto para eles.

### Bloqueio essencial antes da autorização real

Não foi iniciado login nem conexão privada de Google/Microsoft: faltam aplicativos
OAuth registrados pelo administrador e suas configurações de servidor:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.
- APIs Google correspondentes habilitadas e tela de consentimento/usuários de teste
  configurados; consentimento administrativo Microsoft quando a organização exigir.

Foi configurado apenas o valor público `JARVIS_CONNECTOR_ORIGIN` na Vercel,
exclusivo de Preview e da branch experimental, sem afetar produção:

`https://jarvis-kiro-git-feature-diretor-tecnico-agent-umiversokiro.vercel.app`

Callbacks exatos para registrar como aplicações web nos provedores:

- `/api/director/workspace-connectors/google/callback` nesse domínio.
- `/api/director/workspace-connectors/microsoft/callback` nesse domínio.

O endereço completo aparece na interface. Os botões de autorização ficam bloqueados
sem o cofre e a configuração de aplicativo. Nenhuma chave deve ser enviada pelo chat,
colocada no frontend ou copiada de plugins ChatGPT. Depois do cadastro administrativo,
o proprietário seleciona os serviços e autoriza dentro do Jarvis. Até a primeira
leitura bem-sucedida, a interface não anuncia acesso verificado.

PKCE S256, state de uso único com dez minutos de validade, cookie HttpOnly SameSite,
vínculo ao navegador e à validade da sessão original protegem o fluxo. Desconectar
invalida callbacks e renovações em andamento; a remoção local não declara revogação
remota. URLs, campos e limites das leituras são fixos. Não há escrita, execução de
ferramentas, envio de e-mail, publicação ou inferência no adaptador.

Fontes oficiais conferidas:
https://developers.google.com/identity/protocols/oauth2/web-server e
https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow.

## Prioridades Kiro e demais serviços

- Grok (xAI), confirmado pelo proprietário: prioridade Kiro. O cartão abre Grok
  com aviso claro; assinatura de chat não equivale à API xAI. Não foi configurada
  inferência xAI paga. Disponibilidade de modelo Grok via Abacus precisa ser
  confirmada pelo catálogo autenticado; não foi presumida.
- OBS / Kiro TV: falta ponte local autenticada até o OBS no computador.
  Nenhum software foi instalado no aparelho nem porta local exposta à internet.
- Redes sociais: não têm adaptador habilitado apenas por constarem no catálogo.
  APIs, revisão de aplicativo e escopos dependem da plataforma.
- Bancos/finanças: dependem do banco e de API ou provedor Open Finance apropriado.
  Não foram solicitadas senhas bancárias nem implementadas transferências.
- GitHub/Supabase/Vercel e Abacus mantêm suas verificações de autorização existentes.
  A conexão administrativa deste chat não é transferida para o backend Jarvis.

## Evidência de validação

Testes executam as implementações reais dos fluxos com armazenamento e provedores
isolados: seleção de escopos, state/PKCE, expiração, replay, vínculo de navegador,
renovação, recusa, retirada de evidência e desconexão durante callback/renovação.
Testes de navegador em 1440/390/320 px cobrem bloqueio sem configuração, leitura de
metadados, seleção de serviços, câmera por gesto e encerramento dos tracks.
Esses testes não são consentimento nem conexão real às contas do proprietário.

As capturas de teste em `/tmp/jarvis-workspace-evidence` contêm dados simulados.
Build e TypeScript devem passar antes do push. Sem main, deploy de produção,
ativação de cobrança ou acesso privado adicional.
