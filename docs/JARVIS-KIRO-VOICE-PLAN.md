# Jarvis Kiro — identidade vocal brasileira e escolha de TTS

## Direção aprovada
Voz masculina brasileira, médio-grave, calma, elegante, humana, inteligente e sutilmente bem-humorada. Referência de atmosfera: assistente cinematográfico dublado em português, **sem clonar a voz ou imitar fielmente um ator/dublador**.

## Candidatos
1. **ElevenLabs**: pesquisar vozes nativas pt-BR licenciadas. Comparar Flash v2.5 e v4 Turbo por velocidade e naturalidade. Streaming e cancelamento de áudio obrigatório.
2. **OpenAI Realtime**: alternativa para conversação por áudio de baixa latência e interrupção; fazer avaliação de vozes pt-BR. Os antigos modelos do endpoint Speech estão programados para descontinuação em 2027-01-06; não iniciar uma nova dependência neles.
3. **Browser SpeechSynthesis**: manter como fallback sem nova cobrança.

## Requisitos de integração
- Chaves apenas no servidor e consentimento/configuração de custos.
- Nenhuma mudança visual na home; preferências de voz ficam ocultas no menu atual.
- Um único gerenciador de reprodução deve expor speak/cancel/isSpeaking.
- Cancelar áudio imediatamente por barge-in; o monitor atual é experimental e precisa de AEC/VAD robustos.
- Não enviar transcrições a um serviço extra sem transparência e autorização.
- Testar iPhone Safari e Windows Chrome/Edge separadamente.
- Avaliar pronúncia brasileira, qualidade, início de fala, cancelamento real e custo por minuto.
- NÃO ativar provedores pagos nem publicar sem testes e confirmação.

## Critério de aceite
Fala natural em pt-BR, troca de voz nas preferências, fallback funcional, sem interferência no núcleo 3D, sem eco interrompendo sozinho e medição de latência ponta a ponta.
