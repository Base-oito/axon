import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { can, isAdmin } from '../lib/permissions'

type Comunicado = {
  id: number
  titulo: string
  conteudo: string
  imagem_url: string | null
  ativo: boolean
  created_at: string
  criador_nome: string
}

type Visualizacao = {
  user_id: number
  display_name: string
  username: string
  viewed_at: string
}

function getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('nfse_token') || '{}').access_token } catch { return null }
}

function getUserRole(): string {
  try {
    const t = getToken()
    if (!t) return ''
    const p = JSON.parse(atob(t.split('.')[1]))
    return p.role || ''
  } catch { return '' }
}

function formatDateTime(d: string): string {
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
      date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}

function formatDateBR(d: string): string {
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('pt-BR')
  } catch { return '-' }
}

export default function Comunicados() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const userRole = getUserRole()
  const isAdmin = can.comunicados.gerenciar()

  const [loading, setLoading] = useState(true)
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formTitulo, setFormTitulo] = useState('')
  const [formConteudo, setFormConteudo] = useState('')
  const [formImagemUrl, setFormImagemUrl] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [showVisualizar, setShowVisualizar] = useState<number | null>(null)
  const [visualizacoes, setVisualizacoes] = useState<Visualizacao[]>([])
  const [visualizacoesLoading, setVisualizacoesLoading] = useState(false)
  const [expandedConteudo, setExpandedConteudo] = useState<Comunicado | null>(null)

  const [toggleLoading, setToggleLoading] = useState<number | null>(null)

  useEffect(() => {
    const t = getToken()
    if (!t) { navigate('/login'); return }
    loadComunicados(t)
    loadUnreadCount(t)
  }, [navigate])

  const loadComunicados = async (t?: string) => {
    const token = t || getToken()
    if (!token) return
    setLoading(true)
    try {
      const r = await fetch('/api/comunicados', { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      setComunicados(Array.isArray(d) ? d : [])
    } catch { setComunicados([]) }
    setLoading(false)
  }

  const loadUnreadCount = async (t?: string) => {
    const token = t || getToken()
    if (!token) return
    try {
      const r = await fetch('/api/comunicados/ativos', { headers: { Authorization: 'Bearer ' + token } })
      const d = await r.json()
      setUnreadCount(Array.isArray(d) ? d.length : 0)
    } catch { setUnreadCount(0) }
  }

  const openCreate = () => {
    setEditingId(null)
    setFormTitulo('')
    setFormConteudo('')
    setFormImagemUrl('')
    setFormAtivo(true)
    setShowModal(true)
  }

  const openEdit = (c: Comunicado) => {
    setEditingId(c.id)
    setFormTitulo(c.titulo)
    setFormConteudo(c.conteudo)
    setFormImagemUrl(c.imagem_url || '')
    setFormAtivo(c.ativo)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setFormTitulo('')
    setFormConteudo('')
    setFormImagemUrl('')
    setFormAtivo(true)
  }

  const saveComunicado = async () => {
    const t = getToken()
    if (!t) return
    if (!formTitulo.trim()) { alert('Título é obrigatório'); return }
    if (!formConteudo.trim()) { alert('Conteúdo é obrigatório'); return }
    setSaving(true)
    try {
      const body: Record<string, any> = { titulo: formTitulo.trim(), conteudo: formConteudo.trim(), imagem_url: formImagemUrl.trim() || null }
      if (editingId) {
        body.ativo = formAtivo
        await fetch(`/api/comunicados/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      } else {
        await fetch('/api/comunicados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
          body: JSON.stringify(body),
        })
      }
      closeModal()
      loadComunicados()
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar comunicado')
    }
    setSaving(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const t = getToken()
    if (!t) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/comunicados/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
        body: fd,
      })
      if (!r.ok) throw new Error('Falha no upload')
      const data = await r.json()
      setFormImagemUrl(data.url || data.path || '')
    } catch (e: any) {
      alert(e.message || 'Erro ao fazer upload da imagem')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const toggleAtivo = async (c: Comunicado) => {
    const t = getToken()
    if (!t) return
    setToggleLoading(c.id)
    try {
      await fetch(`/api/comunicados/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({
          titulo: c.titulo,
          conteudo: c.conteudo,
          imagem_url: c.imagem_url,
          ativo: !c.ativo,
        }),
      })
      loadComunicados()
    } catch (e: any) {
      alert(e.message || 'Erro ao atualizar comunicado')
    }
    setToggleLoading(null)
  }

  const deleteComunicado = async (id: number) => {
    if (!confirm('Excluir este comunicado?')) return
    const t = getToken()
    if (!t) return
    try {
      const r = await fetch(`/api/comunicados/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + t },
      })
      if (!r.ok) throw new Error('Falha ao excluir')
      loadComunicados()
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir comunicado')
    }
  }

  const openVisualizar = async (c: Comunicado) => {
    const t = getToken()
    if (!t) return
    setShowVisualizar(c.id)
    setExpandedConteudo(c)
    setVisualizacoesLoading(true)
    try {
      const r = await fetch(`/api/comunicados/${c.id}/visualizacoes`, {
        headers: { Authorization: 'Bearer ' + t },
      })
      if (r.ok) {
        setVisualizacoes(await r.json())
      } else {
        setVisualizacoes([])
      }
    } catch { setVisualizacoes([]) }
    setVisualizacoesLoading(false)
  }

  const closeVisualizar = () => {
    setShowVisualizar(null)
    setExpandedConteudo(null)
    setVisualizacoes([])
  }

  const markAsViewed = async (id: number) => {
    const t = getToken()
    if (!t) return
    try {
      await fetch(`/api/comunicados/${id}/visualizar`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
      })
      loadUnreadCount()
      openVisualizar(expandedConteudo!)
    } catch (e: any) {
      alert(e.message || 'Erro ao marcar como visualizado')
    }
  }

  return (
    <div className="h-screen bg-core-black text-off-white flex overflow-hidden">
      <Sidebar currentPage="/comunicados" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-sm tracking-wider" style={{ fontWeight: 500 }}>Comunicados</h1>
              <p className="text-pulse-ash text-sm">Gerenciamento de comunicados e avisos</p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-4">
                {unreadCount > 0 && (
                  <span className="bg-electric-teal/20 text-electric-teal text-xs px-3 py-1.5 rounded-full border border-electric-teal/30">
                    {unreadCount} não {unreadCount === 1 ? 'lido' : 'lidos'}
                  </span>
                )}
                <button onClick={openCreate}
                  className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors">
                  + Novo Comunicado
                </button>
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <div className="text-4xl mb-4">🔒</div>
                <div className="text-pulse-ash text-sm">Acesso restrito.</div>
                <div className="text-pulse-ash text-xs mt-2">Esta página é exclusiva para administradores e líderes.</div>
              </div>
            </div>
          )}

          {isAdmin && loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-pulse-ash text-sm">Carregando comunicados...</div>
            </div>
          )}

          {isAdmin && !loading && (
            <div className="space-y-4">
              <div className="bg-rich-carbon border border-urban-smoke rounded-xl overflow-hidden">
                {comunicados.length === 0 ? (
                  <div className="text-center py-16 text-pulse-ash text-sm">
                    Nenhum comunicado cadastrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-urban-smoke text-pulse-ash tracking-wider">
                          <th className="text-left py-3 px-4">Título</th>
                          <th className="text-left py-3 px-4">Criador</th>
                          <th className="text-left py-3 px-4">Data</th>
                          <th className="text-center py-3 px-4">Ativo</th>
                          <th className="text-center py-3 px-4">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comunicados.map(c => (
                          <tr key={c.id} className="border-b border-urban-smoke/30 hover:bg-urban-smoke/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {c.imagem_url && (
                                  <img src={c.imagem_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                )}
                                <span className="truncate max-w-[300px]">{c.titulo}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-pulse-ash">{c.criador_nome || '-'}</td>
                            <td className="py-3 px-4 text-pulse-ash whitespace-nowrap">{formatDateBR(c.created_at)}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleAtivo(c) }}
                                disabled={toggleLoading === c.id}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                                  c.ativo ? 'bg-success' : 'bg-pulse-ash/50'
                                } ${toggleLoading === c.id ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                                    c.ativo ? 'translate-x-4' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openVisualizar(c)}
                                  className="px-2.5 py-1 rounded text-xs tracking-wider text-electric-teal border border-electric-teal/30 hover:bg-electric-teal/10 transition-colors"
                                  title="Visualizações"
                                >
                                  👁
                                </button>
                                <button
                                  onClick={() => openEdit(c)}
                                  className="px-2.5 py-1 rounded text-xs tracking-wider text-off-white border border-urban-smoke hover:border-electric-teal hover:text-electric-teal transition-colors"
                                  title="Editar"
                                >
                                  ✏
                                </button>
                                <button
                                  onClick={() => deleteComunicado(c.id)}
                                  className="px-2.5 py-1 rounded text-xs tracking-wider text-infrared border border-infrared/30 hover:bg-infrared/10 transition-colors"
                                  title="Excluir"
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80 backdrop-blur-sm">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-urban-smoke flex items-center justify-between">
              <h3 className="text-sm font-roc tracking-wider" style={{ fontWeight: 500 }}>
                {editingId ? 'Editar Comunicado' : 'Novo Comunicado'}
              </h3>
              <button onClick={closeModal} className="text-pulse-ash hover:text-off-white transition-colors text-sm leading-none">✕</button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Título</label>
                <input
                  type="text"
                  value={formTitulo}
                  onChange={e => setFormTitulo(e.target.value)}
                  placeholder="Título do comunicado"
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-4 py-2.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                />
              </div>

              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Conteúdo</label>
                <textarea
                  value={formConteudo}
                  onChange={e => setFormConteudo(e.target.value)}
                  placeholder="Conteúdo do comunicado..."
                  rows={8}
                  className="w-full bg-core-black border border-urban-smoke rounded-lg px-4 py-2.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal resize-y"
                />
              </div>

              <div>
                <label className="block text-xs tracking-wider text-pulse-ash mb-1.5">Imagem URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formImagemUrl}
                    onChange={e => setFormImagemUrl(e.target.value)}
                    placeholder="https://... ou faça upload"
                    className="flex-1 bg-core-black border border-urban-smoke rounded-lg px-4 py-2.5 text-xs text-off-white placeholder-pulse-ash focus:outline-none focus:border-electric-teal"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2.5 rounded-lg text-xs tracking-wider border border-urban-smoke text-pulse-ash hover:text-off-white hover:border-electric-teal transition-colors disabled:opacity-50 shrink-0"
                  >
                    {uploading ? '...' : 'Upload'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {formImagemUrl && (
                  <div className="mt-2">
                    <img src={formImagemUrl} alt="Preview" className="max-h-32 rounded-lg border border-urban-smoke" />
                  </div>
                )}
              </div>

              {editingId && (
                <div className="flex items-center gap-3">
                  <span className="text-xs tracking-wider text-pulse-ash">Ativo</span>
                  <button
                    onClick={() => setFormAtivo(!formAtivo)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                      formAtivo ? 'bg-success' : 'bg-pulse-ash/50'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                        formAtivo ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-urban-smoke flex items-center justify-end gap-3">
              <button onClick={closeModal}
                className="px-4 py-2 rounded-lg text-xs tracking-wider border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Cancelar
              </button>
              <button onClick={saveComunicado} disabled={saving}
                className="px-4 py-2 rounded-lg text-xs tracking-wider bg-electric-teal text-white hover:bg-electric-teal/80 transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVisualizar && expandedConteudo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-core-black/80 backdrop-blur-sm">
          <div className="bg-rich-carbon border border-urban-smoke rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-urban-smoke flex items-center justify-between">
              <h3 className="text-sm font-roc tracking-wider" style={{ fontWeight: 500 }}>
                {expandedConteudo.titulo}
              </h3>
              <button onClick={closeVisualizar} className="text-pulse-ash hover:text-off-white transition-colors text-sm leading-none">✕</button>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-xs text-pulse-ash">
                Criado por <span className="text-off-white">{expandedConteudo.criador_nome || '-'}</span> em{' '}
                <span className="text-off-white">{formatDateTime(expandedConteudo.created_at)}</span>
                {' '}&middot;{' '}
                <span className={expandedConteudo.ativo ? 'text-success' : 'text-pulse-ash'}>
                  {expandedConteudo.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="bg-core-black border border-urban-smoke rounded-lg p-4">
                <div className="text-sm text-off-white whitespace-pre-wrap">{expandedConteudo.conteudo}</div>
                {expandedConteudo.imagem_url && (
                  <img src={expandedConteudo.imagem_url} alt="" className="mt-3 max-h-64 rounded-lg border border-urban-smoke" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => markAsViewed(expandedConteudo.id)}
                  className="px-3 py-1.5 rounded text-xs tracking-wider text-electric-teal border border-electric-teal/30 hover:bg-electric-teal/10 transition-colors"
                >
                  Marcar como visualizado
                </button>
              </div>

              <div>
                <h4 className="text-xs tracking-wider text-pulse-ash mb-3">
                  Visualizações ({visualizacoes.length})
                </h4>
                {visualizacoesLoading ? (
                  <div className="text-center py-4 text-pulse-ash text-xs">Carregando...</div>
                ) : visualizacoes.length === 0 ? (
                  <div className="text-center py-4 text-pulse-ash text-xs">Nenhuma visualização registrada.</div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {visualizacoes.map(v => (
                      <div key={v.user_id} className="flex items-center justify-between py-1.5 px-3 rounded bg-core-black border border-urban-smoke/50 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                          <span className="text-off-white">{v.display_name || v.username}</span>
                          <span className="text-pulse-ash">@{v.username}</span>
                        </div>
                        <span className="text-pulse-ash text-xs">{formatDateTime(v.viewed_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-urban-smoke flex items-center justify-end">
              <button onClick={closeVisualizar}
                className="px-4 py-2 rounded-lg text-xs tracking-wider border border-urban-smoke text-pulse-ash hover:text-off-white transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
