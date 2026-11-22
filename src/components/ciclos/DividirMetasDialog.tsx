import { Check, Merge, Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Botao, Confirmar, Dialogo, Entrada, Selecao } from '@/components/ui'
import { useApagarMetasDaDisciplina, useDividirMetas } from '@/hooks/dados'
import type { CicloDados } from '@/hooks/useCicloDados'
import { assuntosDaDisciplina, iniciosAtuais, iniciosDeNEmN, iniciosPorPrincipal, metasPorDisciplina, segmentar, temFilhos } from '@/lib/ciclos'
import { numeracao, topicosDaDisciplina } from '@/lib/topicos'
import { cn, mensagemErro } from '@/lib/utils'
import type { Disciplina, Topico } from '@/types'

/**
  Dividir uma disciplina em metas: a lista do edital com um corte onde começa cada meta. Só os assuntos
  (tópicos sem subtópicos) entram nas metas; o tópico com subtópicos aparece como título da seção.
  Cada meta tem um nome, que pode ser editado.
*/
export function DividirMetasDialog({ dados, disciplina, aoFechar }: { dados: CicloDados; disciplina: Disciplina | null; aoFechar: () => void }) {
  const dividir = useDividirMetas()
  const apagarTudo = useApagarMetasDaDisciplina()
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)

  const lista = useMemo(() => (disciplina ? topicosDaDisciplina(dados.topicos, disciplina.id) : []), [dados.topicos, disciplina])
  const assuntos = useMemo(() => assuntosDaDisciplina(lista), [lista])
  const numeros = useMemo(() => numeracao(lista), [lista])
  const existentes = useMemo(() => (disciplina ? (metasPorDisciplina(dados.metas).get(disciplina.id) ?? []) : []), [dados.metas, disciplina])

  const [inicios, setInicios] = useState<Set<string>>(new Set())
  // nome editado de cada meta, guardado pelo primeiro tópico dela
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [n, setN] = useState('2')
  useEffect(() => {
    if (!disciplina) return
    setInicios(existentes.length ? iniciosAtuais(lista) : iniciosPorPrincipal(lista))
    setNomes(new Map())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplina?.id])

  const segmentos = useMemo(() => segmentar(lista, inicios, existentes), [lista, inicios, existentes])
  const nomeDe = (i: number) => nomes.get(segmentos[i].assuntos[0].id) ?? segmentos[i].nome
  // cada meta na tela leva junto os títulos de seção que vêm logo antes dos assuntos dela
  const grupos = useMemo(() => {
    const r: { itens: { t: Topico; secao: boolean }[] }[] = []
    let pendentes: { t: Topico; secao: boolean }[] = []
    let k = -1
    lista.forEach((t, i) => {
      if (temFilhos(lista, i)) {
        pendentes.push({ t, secao: true })
        return
      }
      if (k === -1 || inicios.has(t.id)) {
        k++
        r.push({ itens: [] })
      }
      r[k].itens.push(...pendentes, { t, secao: false })
      pendentes = []
    })
    return r
  }, [lista, inicios])

  const alternarCorte = (id: string) =>
    setInicios((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const salvar = async () => {
    if (!disciplina) return
    try {
      await dividir.mutateAsync({
        disciplinaId: disciplina.id,
        existentes: existentes.map((m) => m.id),
        metas: segmentos.map((sg, i) => ({
          metaId: sg.metaId,
          nome: nomeDe(i),
          topicoIds: sg.assuntos.map((t) => t.id),
        })),
        // os títulos de seção ficam sem meta
        semMeta: lista.filter((t, i) => temFilhos(lista, i) && t.meta_id).map((t) => t.id),
      })
      toast.success(`${disciplina.nome}: ${segmentos.length} ${segmentos.length === 1 ? 'meta' : 'metas'}.`)
      aoFechar()
    } catch (e) {
      toast.error(`Não deu para salvar as metas. ${mensagemErro(e)}`)
    }
  }

  return (
    <>
      <Dialogo
        aberto={!!disciplina && !confirmandoApagar}
        aoMudar={(a) => !a && aoFechar()}
        titulo={`Metas de ${disciplina?.nome ?? ''}`}
        descricao="Toque na tesoura num assunto para começar uma meta nova ali. Os tópicos com subtópicos aparecem como título da seção."
        largura="max-w-2xl"
      >
        {assuntos.length === 0 ? (
          <p className="rounded-2xl bg-superficie-2 p-5 text-center text-[15px] text-tinta-suave">Esta disciplina ainda não tem tópicos. Cadastre o edital dela primeiro.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-tinta-suave">Atalhos:</span>
              <Botao tamanho="sm" variante="secundario" onClick={() => setInicios(iniciosPorPrincipal(lista))}>
                1 por tópico principal
              </Botao>
              <Botao tamanho="sm" variante="secundario" onClick={() => setInicios(iniciosDeNEmN(lista, 1))}>
                1 por assunto
              </Botao>
              <span className="inline-flex items-center gap-1.5">
                <Botao tamanho="sm" variante="secundario" onClick={() => setInicios(iniciosDeNEmN(lista, Number(n)))}>
                  Juntar de
                </Botao>
                <Selecao value={n} onChange={(e) => setN(e.target.value)} className="h-8 w-16 py-0 text-sm" aria-label="Quantos tópicos por meta">
                  {[2, 3, 4, 5, 6].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </Selecao>
                <span className="text-tinta-suave">em {n}</span>
              </span>
              <Botao tamanho="sm" variante="fantasma" onClick={() => setInicios(new Set())}>
                Tudo numa meta
              </Botao>
            </div>

            <ol className="space-y-3">
              {grupos.map((g, k) => {
                const sg = segmentos[k]
                if (!sg) return null
                const primeiro = sg.assuntos[0]
                const feitos = sg.assuntos.filter((t) => t.concluido).length
                return (
                  <li key={primeiro.id} className="overflow-hidden rounded-xl border border-linha">
                    <div className="flex flex-wrap items-center gap-2 border-b border-linha bg-superficie-2 px-3 pt-2.5 pb-2">
                      <span className="shrink-0 text-sm font-semibold text-tinta numeros">Meta {k + 1}</span>
                      <Entrada
                        value={nomeDe(k)}
                        onChange={(e) => {
                          const v = e.target.value
                          setNomes((m) => new Map(m).set(primeiro.id, v))
                        }}
                        maxLength={200}
                        aria-label={`Nome da meta ${k + 1}`}
                        className="h-8 min-w-0 flex-1 py-0 text-sm"
                      />
                      <span className="shrink-0 text-xs text-tinta-suave numeros" title="Assuntos concluídos">
                        {feitos}/{sg.assuntos.length}
                      </span>
                      {k > 0 && (
                        <button
                          type="button"
                          onClick={() => alternarCorte(primeiro.id)}
                          title="Juntar com a meta de cima"
                          aria-label={`Juntar a meta ${k + 1} com a de cima`}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa hover:text-tinta"
                        >
                          <Merge className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                    <ul>
                      {g.itens.map(({ t, secao }) => (
                        <li
                          key={t.id}
                          className={cn('group flex items-center gap-3 pr-3', secao ? 'pt-2.5 pb-0.5' : 'py-2', !secao && t.concluido && 'bg-visto-fundo')}
                          style={{ paddingLeft: `${0.75 + t.nivel * 1.1}rem` }}
                        >
                          <span className={cn('shrink-0 text-sm text-tinta-suave numeros', secao && 'text-xs font-semibold')}>{numeros.get(t.id)}</span>
                          <span className={cn('min-w-0 flex-1 leading-snug', secao ? 'text-xs font-semibold text-tinta-suave' : 'text-[15px] text-tinta')}>{t.nome}</span>
                          {!secao && t.concluido && <Check className="size-4 shrink-0 text-visto-texto" aria-label="Concluído" />}
                          {!secao && t.id !== primeiro.id && (
                            <button
                              type="button"
                              onClick={() => alternarCorte(t.id)}
                              title="Começar uma meta nova neste assunto"
                              aria-label={`Começar uma meta nova em "${t.nome}"`}
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave/70 hover:bg-nevoa hover:text-tinta sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            >
                              <Scissors className="size-4" aria-hidden />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ol>
          </>
        )}

        <div className="-mx-5 mt-6 flex flex-wrap items-center gap-2 border-t border-linha/70 px-5 pt-4 sm:-mx-6 sm:px-6">
          {existentes.length > 0 && (
            <Botao variante="fantasma" className="mr-auto px-2 text-ruim" onClick={() => setConfirmandoApagar(true)}>
              Desfazer as metas
            </Botao>
          )}
          <span className="text-sm text-tinta-suave numeros sm:ml-auto">
            {segmentos.length} {segmentos.length === 1 ? 'meta' : 'metas'}
          </span>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={dividir.isPending} disabled={!assuntos.length}>
            Salvar metas
          </Botao>
        </div>
      </Dialogo>
      <Confirmar
        aberto={confirmandoApagar}
        aoMudar={setConfirmandoApagar}
        titulo="Desfazer as metas desta disciplina?"
        texto="Os tópicos continuam no edital, com o que já foi concluído; só a divisão em metas e as orientações escritas nelas são apagadas."
        textoBotao="Desfazer metas"
        carregando={apagarTudo.isPending}
        aoConfirmar={async () => {
          if (!disciplina) return
          try {
            await apagarTudo.mutateAsync(disciplina.id)
            toast.success('Metas desfeitas.')
            setConfirmandoApagar(false)
            aoFechar()
          } catch (e) {
            toast.error(mensagemErro(e))
          }
        }}
      />
    </>
  )
}
