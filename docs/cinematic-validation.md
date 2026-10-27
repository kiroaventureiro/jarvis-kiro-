# Validação das demonstrações progressivas

27/10/2026 — feature/diretor-tecnico-agent. Complementa cinematic-demonstrations.md e os relatórios anteriores da interface.

## Resultado verificado

- 238 testes Node aprovados, sem falhas.
- TypeScript sem erros.
- Build de produção Next.js aprovado localmente.
- 52 cenários de navegador aprovados: 19 de demonstração/pesquisa/exportação; 13 de módulos e memória visual; 12 de voz; 4 de anexos; 4 do HUD.
- Desktop, mobile, tela pequena e orientação horizontal cobertos por emulação Chrome. Nenhum iPhone físico nem reconhecimento de fala real foi usado.
- Fontes e contas dos testes funcionais são simuladas, exceto as leituras públicas descritas abaixo. Nenhuma sessão neural paga foi iniciada.

Os testes de navegador verificam a aplicação compilada, não um mock da interface. O transporte de serviços e a voz podem ser simulados sem contornar as proteções do código de produção. A autorização da rota também é verificada com sessão ausente, origem cruzada e consulta inválida.

## Demonstrações e regressões

Entrada progressiva de caracteres, pausa da digitação, mudança automática de cena, salto manual, retomada, core recolhido no centro, mapa de apoio, valores negativos, busca/seleção/zoom do mapa-múndi, link Google Maps sem chave e manutenção da coleção ao navegar.

Anexos: arrastar, colar, prévias, análise, orientação por voz, remoção e descarte, cancelamento ignorando resposta tardia e tratamento de falhas de autorização. O espaço reservado aos anexos evita que os controles de apresentação cubram os botões de remoção.

Voz: ativação, palavra-chave, comandos após ativação, deduplicação, supressão da própria escuta durante fala, retomada, desligamento, seleção/prévia, permissão negada, erro do provedor sem repetição paga e modo manual conservador no iOS.

## Exportações verificadas

- PDF com assinatura válida, objetos e referências cruzadas válidos, múltiplas páginas e conteúdo completo. Inspecionado por pdfinfo e renderizado por pdftoppm para revisão visual.
- PNG 1440×900 com bytes válidos.
- WebM VP8 1024×640, 18 segundos, 216 quadros no cenário de seis etapas. Verificado por ffprobe e por reprodução/seek perto do fim no navegador. Sem trilha de áudio.
- Cancelamento libera o codificador e reabilita os formatos.
- JSON preserva a cena normalizada.

A primeira abordagem com captura de canvas em tempo real podia truncar a gravação neste ambiente; foi substituída por codificação de quadros com timestamps explícitos. O renderizador reutiliza o mapa estático e fornece pixels de CPU ao codificador para reduzir dependência do caminho GPU. Não há captura de tela, microfone ou áudio do sistema.

O Chrome isolado pode cancelar a gravação do download no disco. Foram verificados geração/captura dos bytes e início do download, sem modificar a política de downloads do computador. A persistência de arquivos fora deste ambiente depende das permissões do navegador do usuário.

## Consultas públicas reais

O adaptador foi executado contra BCB e IBGE sem chave ou modelo. O BCB recusou quantidades acima de 20 observações; as consultas Selic e dólar foram corrigidas para respeitar esse limite, com teste de regressão específico. Respostas com datas posteriores ao dia da consulta são filtradas.

IPCA/IBGE e as séries Selic/dólar tiveram respostas válidas verificadas. Houve também indisponibilidade intermitente em fontes individuais. O sistema conserva a procedência e a hora de cada coleta e não apresenta falha como zero nem mistura valores de outra fonte silenciosamente. A leitura ao vivo não garante disponibilidade futura.

A economia exibida é um recorte de inflação, juros e câmbio. Notícias, PIB, desemprego, mapas com geocodificação integrada, imagens geradas por IA e vídeo generativo continuam fora deste escopo. Links e mídia fornecida pelo usuário continuam suportados.

## Entrega e limites

Somente arquivos da branch de desenvolvimento são entregues. Nenhuma mudança de produção, merge na main, credencial de conta, plano pago ou recarga automática foi acionada. Os catálogos existentes e as regras de autorização dos conectores foram preservados.

CI e URL do Preview devem ser conferidos no commit desta entrega. O Preview preserva autenticação e permissões; testes com fixture não comprovam conexão a contas reais.
