export function abacusPlatformIntent(message: string) {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\b(abacus|abaqus|avacus|abagus)\b/.test(n) &&
    /\b(projeto|projetos|deployments|deployment|deploys|deploy|implantacoes|acesso|conexao|permissao)\b/.test(
      n,
    ) &&
    /\b(verifique|verifica|verificar|consulte|consulta|consultar|liste|listar|quais|mostre|mostrar|status|tenho|disponiveis|conectad[oa])\b/.test(
      n,
    )
  );
}
