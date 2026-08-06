type Role = 'colaborador' | 'lider' | 'recepcao' | 'administrador' | 'super_admin'

export function getUserRole(): Role {
  try {
    const t = JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token
    if (!t) return 'colaborador'
    return (JSON.parse(atob(t.split('.')[1])).role || 'colaborador') as Role
  } catch { return 'colaborador' }
}

export function isAdmin(role?: Role): boolean {
  const r = role || getUserRole()
  return r === 'administrador' || r === 'super_admin'
}

export function isLeaderOrAbove(role?: Role): boolean {
  const r = role || getUserRole()
  return r === 'lider' || r === 'administrador' || r === 'super_admin'
}

export function isRecepcao(role?: Role): boolean {
  const r = role || getUserRole()
  return r === 'recepcao'
}

// Module visibility in sidebar (false = hidden)
export function getSidebarVisibility(role?: Role): Record<string, boolean> {
  const r = role || getUserRole()
  return {
    dashboard: true,
    inteligencia: true,
    clientes: true,
    obrigacoes: true,
    processos: true,
    tarefas: true,
    calendario: true,
    reunioes: true,
    automacao: true,
    'importacao-contabil': true,
    comunicados: isAdmin(r),
    configuracoes: true,
    auditoria: isAdmin(r),
    quartel: isAdmin(r),
    chat: true,
    whatsapp: true,
    suporte: true,
    solicitacoes: true,
  }
}

// Action-level permissions per module
export const can = {
  reunioes: {
    criar: (r?: Role) => {
      const role = r || getUserRole()
      return role === 'recepcao' || isAdmin(role)
    },
  },
  tarefas: {
    criarParaOutros: (r?: Role) => isAdmin(r || getUserRole()),
    verTodas: (r?: Role) => isAdmin(r || getUserRole()),
  },
  clientes: {
    editar: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
  },
  obrigacoesModelos: {
    criarEditar: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
  },
  processos: {
    criarModelos: (r?: Role) => isAdmin(r || getUserRole()),
    iniciar: (r?: Role) => true,
  },
  automacao: {
    parsers: (r?: Role) => (r || getUserRole()) === 'super_admin',
    lote: () => true,
    treinar: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
    treinamentos: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
    agentes: () => true,
    gateway: () => true,
    certificados: (r?: Role) => {
      const role = r || getUserRole()
      return isLeaderOrAbove(role) || role === 'recepcao'
    },
  },
  comunicados: {
    gerenciar: (r?: Role) => isAdmin(r || getUserRole()),
  },
  configuracoes: {
    equipe: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
    departamentos: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
    downloads: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
    email: (r?: Role) => isAdmin(r || getUserRole()),
  },
  calendario: {
    verTudo: (r?: Role) => isAdmin(r || getUserRole()),
    verDepartamento: (r?: Role) => isLeaderOrAbove(r || getUserRole()),
  },
}
