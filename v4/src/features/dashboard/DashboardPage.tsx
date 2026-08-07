export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Visão geral</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Clientes ativos', value: '—' },
          { label: 'Documentos este mês', value: '—' },
          { label: 'Obrigações pendentes', value: '—' },
          { label: 'Valor em ICMS', value: 'R$ —' },
        ].map(card => (
          <div
            key={card.label}
            className="card-soft hover-lift rounded-xl bg-card p-5"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
