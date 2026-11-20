import { ChevronRight, Layers, Pencil, Plus, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LeiDialog } from '@/components/leis/LeiDialog'
import { BarraProgresso, Botao, CabecalhoPagina, Carregando, Painel, Vazio } from '@/components/ui'
import { useDisciplinas, useLeiLinhas, useLeis } from '@/hooks/dados'
import { resumirLei } from '@/lib/leis'
import { corSobre, porcentagem } from '@/lib/utils'
import type { Lei, LeiLinha } from '@/types'

/** Menu Leis: as leis mapeadas, com quantos artigos foram marcados e revisados */
export function Leis() {
  const leis = useLeis()
  const linhas = useLeiLinhas()
  const disciplinas = useDisciplinas()
  const [dialogo, setDialogo] = useState<{ lei: Lei | null } | null>(null)

  const porLei = useMemo(() => {
    const m = new Map<string, LeiLinha[]>()
    for (const l of linhas.data ?? []) {
      const lista = m.get(l.lei_id)
      if (lista) lista.push(l)
      else m.set(l.lei_id, [l])
    }
    return m
  }, [linhas.data])

  if (leis.isLoading || linhas.isLoading || disciplinas.isLoading) return <Carregando />
  const lista = leis.data ?? []

  return (
    <>
      <CabecalhoPagina
        titulo="Leis"
        subtitulo="Mapeie os artigos mais cobrados de cada lei, anote e crie flashcards direto das anotações."
        acoes={
          <Botao onClick={() => setDialogo({ lei: null })}>
            <Plus className="size-4" aria-hidden /> Nova lei
          </Botao>
        }
      />
      {lista.length === 0 ? (
        <Painel>
          <Vazio
            icone={<Scale className="size-9" aria-hidden />}
            titulo="Nenhuma lei ainda"
            texto="Crie a primeira lei e comece a marcar os artigos que mais caem."
            acao={<Botao onClick={() => setDialogo({ lei: null })}>Criar a primeira lei</Botao>}
          />
        </Painel>
      ) : (
        <ul className="space-y-3">
          {lista.map((lei) => {
            const d = disciplinas.data?.find((x) => x.id === lei.disciplina_id)
            const r = resumirLei(porLei.get(lei.id) ?? [])
            const pct = porcentagem(r.revisados, r.mapeados)
            return (
              <li key={lei.id} className="relative flex items-center gap-3 rounded-2xl border border-linha/70 bg-superficie px-4 py-3.5 transition-colors hover:border-lilas sm:gap-4 sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: d?.cor, color: d ? corSobre(d.cor) : undefined }} aria-hidden>
                  <Scale className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/leis/${lei.id}`} className="block truncate text-[17px] font-medium text-tinta after:absolute after:inset-0">
                    {lei.nome}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm text-tinta-suave numeros">
                    <span>{d?.nome ?? 'Sem disciplina'}</span>
                    <span>
                      {r.mapeados === 0 ? 'nenhum artigo mapeado' : `${r.mapeados} ${r.mapeados === 1 ? 'artigo mapeado' : 'artigos mapeados'}`}
                      {r.porIncidencia.alta > 0 && ` · ${r.porIncidencia.alta} de incidência alta`}
                    </span>
                    {r.cartoes > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Layers className="size-3.5" aria-hidden /> {r.cartoes}
                      </span>
                    )}
                  </p>
                </div>
                {r.mapeados > 0 && (
                  <div className="hidden w-52 shrink-0 items-center gap-3 sm:flex">
                    <BarraProgresso valor={pct} cor="var(--c-visto)" className="flex-1" rotulo={`Artigos revisados de ${lei.nome}`} />
                    <span className="w-24 text-right text-sm text-tinta-suave numeros">
                      {r.revisados}/{r.mapeados} revisados
                    </span>
                  </div>
                )}
                <Botao variante="fantasma" tamanho="icone" aria-label={`Editar ${lei.nome}`} className="relative z-10 shrink-0" onClick={() => setDialogo({ lei })}>
                  <Pencil className="size-4" aria-hidden />
                </Botao>
                <ChevronRight className="size-5 shrink-0 text-tinta-suave" aria-hidden />
              </li>
            )
          })}
        </ul>
      )}
      <LeiDialog aberto={!!dialogo} aoMudar={(v) => !v && setDialogo(null)} lei={dialogo?.lei} />
    </>
  )
}
