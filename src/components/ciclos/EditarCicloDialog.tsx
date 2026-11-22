import { ArrowDown, ArrowUp, Plus, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Botao, Dialogo, Entrada, Selecao } from '@/components/ui'
import { useSalvarSiglas } from '@/hooks/dados'
import type { CicloDados } from '@/hooks/useCicloDados'
import { sequenciaPorPeso, siglaDe, sugerirSigla } from '@/lib/ciclos'
import { cn, corSobre, mensagemErro } from '@/lib/utils'

const CHAVE_PESOS = 'ciclo:pesos'

function lerPesos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PESOS) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

/**
  Editar o ciclo: a ordem em que as disciplinas se revezam (a mesma pode entrar mais de uma vez),
  montar a ordem pelo peso de cada disciplina na prova e as siglas.
*/
export function EditarCicloDialog({ dados, aberto, aoMudar }: { dados: CicloDados; aberto: boolean; aoMudar: (a: boolean) => void }) {
  const salvarSiglas = useSalvarSiglas()
  const [seq, setSeq] = useState<string[]>([])
  const [pesos, setPesos] = useState<Record<string, number>>({})
  const [siglas, setSiglas] = useState<Record<string, string>>({})
  const [adicionar, setAdicionar] = useState('')

  useEffect(() => {
    if (!aberto) return
    setSeq(dados.sequencia)
    setPesos(lerPesos())
    setSiglas(Object.fromEntries(dados.disciplinas.map((d) => [d.id, d.sigla ?? ''])))
    setAdicionar('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const vezes = useMemo(() => {
    const m = new Map<string, number>()
    for (const id of seq) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }, [seq])

  const mover = (i: number, delta: number) =>
    setSeq((s) => {
      const j = i + delta
      if (j < 0 || j >= s.length) return s
      const novo = s.slice()
      ;[novo[i], novo[j]] = [novo[j], novo[i]]
      return novo
    })

  const montarPeloPeso = () => {
    const itens = dados.disciplinas.filter((d) => (pesos[d.id] ?? 1) > 0).map((d) => ({ id: d.id, peso: pesos[d.id] ?? 1 }))
    setSeq(sequenciaPorPeso(itens))
    try {
      localStorage.setItem(CHAVE_PESOS, JSON.stringify(pesos))
    } catch {
      /* sem armazenamento: só não fica salvo */
    }
  }

  const salvar = async () => {
    try {
      const mudadas = dados.disciplinas
        .filter((d) => (siglas[d.id]?.trim() || null) !== (d.sigla?.trim() || null))
        .map((d) => ({ id: d.id, sigla: siglas[d.id]?.trim().toUpperCase().slice(0, 8) || null }))
      if (mudadas.length) await salvarSiglas.mutateAsync(mudadas)
      // a posição continua na disciplina da vez, se ela seguir no ciclo
      const daVez = dados.sequencia[dados.posicao]
      const iguais = seq.length === dados.sequencia.length && seq.every((id, i) => id === dados.sequencia[i])
      if (!iguais) {
        const novaPos = Math.max(0, seq.indexOf(daVez))
        await dados.salvarCiclo.mutateAsync({ sequencia: seq, posicao: novaPos, meta_id: seq.includes(daVez) ? (dados.metaDaVez?.meta.id ?? null) : null })
      }
      toast.success('Ciclo salvo.')
      aoMudar(false)
    } catch (e) {
      toast.error(`Não deu para salvar o ciclo. ${mensagemErro(e)}`)
    }
  }

  const sigla = (id: string) => {
    const d = dados.disciplinaPorId.get(id)
    return d ? siglas[id]?.trim().toUpperCase() || siglaDe({ nome: d.nome, sigla: null }) : '?'
  }

  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo="Editar ciclo" descricao="A ordem em que as disciplinas se revezam. Cada vez que você cumpre uma meta, o ciclo passa para a próxima." largura="max-w-3xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          <h3 className="text-sm font-semibold text-tinta">Ordem do ciclo</h3>
          {seq.length === 0 ? (
            <p className="mt-2 rounded-xl bg-superficie-2 p-4 text-sm text-tinta-suave">Ciclo vazio. Monte pelo peso ao lado ou adicione as disciplinas uma a uma.</p>
          ) : (
            <ol className="mt-2 space-y-1">
              {seq.map((id, i) => {
                const d = dados.disciplinaPorId.get(id)
                if (!d) return null
                const daVez = i === dados.posicao && id === dados.sequencia[dados.posicao]
                return (
                  <li key={`${id}-${i}`} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', daVez ? 'bg-nevoa' : 'hover:bg-superficie-2')}>
                    <span className="w-6 text-right text-xs text-tinta-suave numeros">{i + 1}</span>
                    <span className="grid h-7 min-w-11 place-items-center rounded-full px-1.5 text-xs font-semibold" style={{ background: d.cor, color: corSobre(d.cor) }}>
                      {sigla(id)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-tinta">
                      {d.nome}
                      {daVez && <span className="ml-1.5 text-xs text-tinta-suave">(agora)</span>}
                    </span>
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${d.nome}`} className="grid size-7 place-items-center rounded-md text-tinta-suave hover:bg-nevoa hover:text-tinta disabled:opacity-30">
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === seq.length - 1} aria-label={`Descer ${d.nome}`} className="grid size-7 place-items-center rounded-md text-tinta-suave hover:bg-nevoa hover:text-tinta disabled:opacity-30">
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => setSeq((s) => s.filter((_, k) => k !== i))} aria-label={`Tirar ${d.nome} desta posição`} className="grid size-7 place-items-center rounded-md text-tinta-suave hover:bg-ruim-fundo hover:text-ruim">
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
          <div className="mt-3 flex gap-2">
            <Selecao value={adicionar} onChange={(e) => setAdicionar(e.target.value)} aria-label="Disciplina para adicionar ao ciclo" className="min-w-0 flex-1">
              <option value="">Adicionar disciplina…</option>
              {dados.disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                  {vezes.get(d.id) ? ` (já ${vezes.get(d.id)}×)` : ''}
                </option>
              ))}
            </Selecao>
            <Botao
              variante="secundario"
              disabled={!adicionar || seq.length >= 60}
              onClick={() => {
                setSeq((s) => [...s, adicionar])
                setAdicionar('')
              }}
            >
              <Plus className="size-4" aria-hidden /> Adicionar
            </Botao>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-tinta">Peso e sigla</h3>
          <p className="mt-1 text-sm text-tinta-suave">Peso 2 entra duas vezes no ciclo, bem espaçado; peso 0 fica de fora.</p>
          <ul className="mt-3 space-y-1.5">
            {dados.disciplinas.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.cor }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-tinta" title={d.nome}>
                  {d.nome}
                </span>
                <Entrada
                  value={siglas[d.id] ?? ''}
                  onChange={(e) => setSiglas((s) => ({ ...s, [d.id]: e.target.value.toUpperCase().slice(0, 8) }))}
                  placeholder={sugerirSigla(d.nome)}
                  aria-label={`Sigla de ${d.nome}`}
                  className="h-8 w-20 py-0 text-center text-sm uppercase"
                />
                <Selecao
                  value={String(pesos[d.id] ?? 1)}
                  onChange={(e) => setPesos((p) => ({ ...p, [d.id]: Number(e.target.value) }))}
                  aria-label={`Peso de ${d.nome}`}
                  className="h-8 w-16 py-0 text-sm"
                >
                  {[0, 1, 2].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </Selecao>
              </li>
            ))}
          </ul>
          <Botao variante="secundario" className="mt-3" onClick={montarPeloPeso}>
            <Sparkles className="size-4" aria-hidden /> Montar a ordem pelo peso
          </Botao>
        </section>
      </div>

      <div className="-mx-5 mt-6 flex justify-end gap-2 border-t border-linha/70 px-5 pt-4 sm:-mx-6 sm:px-6">
        <Botao variante="secundario" onClick={() => aoMudar(false)}>
          Cancelar
        </Botao>
        <Botao onClick={salvar} carregando={dados.salvarCiclo.isPending || salvarSiglas.isPending}>
          Salvar ciclo
        </Botao>
      </div>
    </Dialogo>
  )
}
