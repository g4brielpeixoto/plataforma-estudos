import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useProvasFeitas, useSalvarProvaFeita } from '@/hooks/dados'
import { chaveDisciplina, disciplinasConhecidas, formatarNota, lerNota, ROTULO_SITUACAO } from '@/lib/provasFeitas'
import { mensagemErro } from '@/lib/utils'
import type { NotaDisciplina, ProvaFeita, SituacaoProva } from '@/types'
import { AreaTexto, Botao, Campo, Dialogo, Entrada, Selecao } from './ui'

const NOTAS = ['nota_objetiva', 'corte_objetiva', 'nota_discursiva', 'corte_discursiva', 'nota_final', 'corte_final'] as const
type CampoNota = (typeof NOTAS)[number]

const ETAPAS: { titulo: string; nota: CampoNota; corte: CampoNota }[] = [
  { titulo: 'Objetiva', nota: 'nota_objetiva', corte: 'corte_objetiva' },
  { titulo: 'Discursiva', nota: 'nota_discursiva', corte: 'corte_discursiva' },
  { titulo: 'Nota final', nota: 'nota_final', corte: 'corte_final' },
]

const VAZIO = { nome: '', cargo: '', banca: '', data: '', situacao: '', classificacao: '', observacao: '' }
/** Linha do formulário de disciplinas; `nova` = nome digitado pelo usuário */
interface LinhaDisciplina {
  nome: string
  nota: string
  total: string
  nova?: boolean
}

const NOTAS_VAZIAS = Object.fromEntries(NOTAS.map((c) => [c, ''])) as Record<CampoNota, string>

/** Adicionar ou editar uma prova já feita: concurso, data, notas e cortes de cada etapa, situação */
export function ProvaFeitaDialog({ aberto, aoMudar, prova }: { aberto: boolean; aoMudar: (a: boolean) => void; prova: ProvaFeita | null }) {
  const salvar = useSalvarProvaFeita()
  const todas = useProvasFeitas()
  const [disciplinas, setDisciplinas] = useState<LinhaDisciplina[]>([])
  const [f, setF] = useState(VAZIO)
  const [notas, setNotas] = useState(NOTAS_VAZIAS)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setF(
      prova
        ? {
            nome: prova.nome,
            cargo: prova.cargo ?? '',
            banca: prova.banca ?? '',
            data: prova.data,
            situacao: prova.situacao ?? '',
            classificacao: prova.classificacao ? String(prova.classificacao) : '',
            observacao: prova.observacao ?? '',
          }
        : VAZIO,
    )
    setNotas(prova ? (Object.fromEntries(NOTAS.map((c) => [c, prova[c] === null ? '' : formatarNota(prova[c])])) as Record<CampoNota, string>) : NOTAS_VAZIAS)
    // as disciplinas de sempre (e as que você já usou) vêm prontas; as que a prova não teve ficam em branco
    const lancadas = prova?.disciplinas ?? []
    setDisciplinas(
      disciplinasConhecidas([...(todas.data ?? []), ...(prova ? [prova] : [])]).map((nome) => {
        const d = lancadas.find((x) => chaveDisciplina(x.nome) === chaveDisciplina(nome))
        return { nome, nota: d ? formatarNota(d.nota) : '', total: d?.total ? formatarNota(d.total) : '' }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir: recarregar a lista não pode apagar o que está sendo digitado
  }, [aberto, prova])

  const mudarDisciplina = (i: number, parte: Partial<LinhaDisciplina>) => setDisciplinas((v) => v.map((l, j) => (j === i ? { ...l, ...parte } : l)))

  const campo = (chave: keyof typeof VAZIO) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [chave]: e.target.value }))

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!f.nome.trim()) return setErro('Diga de qual concurso foi a prova.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return setErro('Escolha a data da prova.')
    const lidas = Object.fromEntries(NOTAS.map((c) => [c, lerNota(notas[c])])) as Record<CampoNota, number | null>
    if (NOTAS.some((c) => Number.isNaN(lidas[c]))) return setErro('Confira as notas: use só números, com até duas casas (ex.: 72,5).')
    const porDisciplina: NotaDisciplina[] = []
    for (const l of disciplinas) {
      const nome = l.nome.trim()
      const nota = lerNota(l.nota)
      const total = lerNota(l.total)
      if (nota === null && total === null) continue
      if (!nome) return setErro('Dê um nome à disciplina que você adicionou, ou apague as notas dela.')
      if (nota === null) return setErro(`Falta a sua nota em ${nome} (ou apague o total).`)
      if (Number.isNaN(nota) || Number.isNaN(total) || total === 0) return setErro(`Confira os números de ${nome}: só números, com até duas casas.`)
      if (total !== null && nota > total) return setErro(`Em ${nome}, a nota não pode passar do total.`)
      if (porDisciplina.some((d) => chaveDisciplina(d.nome) === chaveDisciplina(nome))) return setErro(`${nome} aparece duas vezes.`)
      porDisciplina.push({ nome, nota, total })
    }
    const classificacao = f.classificacao.trim() ? Number(f.classificacao) : null
    if (classificacao !== null && (!Number.isInteger(classificacao) || classificacao < 1)) return setErro('A classificação é a sua posição: um número inteiro a partir de 1.')
    try {
      await salvar.mutateAsync({
        id: prova?.id,
        nome: f.nome.trim(),
        cargo: f.cargo.trim() || null,
        banca: f.banca.trim() || null,
        data: f.data,
        ...lidas,
        situacao: (f.situacao || null) as SituacaoProva | null,
        classificacao,
        observacao: f.observacao.trim() || null,
        disciplinas: porDisciplina,
      })
      toast.success(prova ? 'Prova atualizada.' : 'Prova adicionada.')
      aoMudar(false)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      titulo={prova ? 'Editar prova' : 'Adicionar prova feita'}
      descricao="Preencha só o que você tiver. Com a nota e o corte de uma etapa já dá para comparar."
      largura="max-w-2xl"
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Campo rotulo="Concurso" htmlFor="pf-nome">
            <Entrada id="pf-nome" value={f.nome} maxLength={120} placeholder="Ex.: TRT 8" onChange={campo('nome')} />
          </Campo>
          <Campo rotulo="Data da prova" htmlFor="pf-data">
            <Entrada id="pf-data" type="date" value={f.data} onChange={campo('data')} className="numeros" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo rotulo="Cargo (opcional)" htmlFor="pf-cargo">
            <Entrada id="pf-cargo" value={f.cargo} maxLength={120} placeholder="Ex.: Técnico judiciário" onChange={campo('cargo')} />
          </Campo>
          <Campo rotulo="Banca (opcional)" htmlFor="pf-banca">
            <Entrada id="pf-banca" value={f.banca} maxLength={80} placeholder="Ex.: FCC" onChange={campo('banca')} />
          </Campo>
        </div>

        <fieldset className="rounded-xl border border-linha/70 bg-superficie-2/50 p-4">
          <legend className="px-1 text-sm font-semibold text-tinta">Notas</legend>
          <div className="space-y-3">
            {ETAPAS.map((etapa) => (
              <div key={etapa.nota} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
                <p className="col-span-2 text-sm font-medium text-tinta sm:col-span-1 sm:pb-2.5">{etapa.titulo}</p>
                <Campo rotulo="Minha nota" htmlFor={`pf-${etapa.nota}`}>
                  <Entrada
                    id={`pf-${etapa.nota}`}
                    inputMode="decimal"
                    value={notas[etapa.nota]}
                    onChange={(e) => setNotas((v) => ({ ...v, [etapa.nota]: e.target.value }))}
                    className="numeros"
                  />
                </Campo>
                <Campo rotulo="Nota de corte" htmlFor={`pf-${etapa.corte}`}>
                  <Entrada
                    id={`pf-${etapa.corte}`}
                    inputMode="decimal"
                    value={notas[etapa.corte]}
                    onChange={(e) => setNotas((v) => ({ ...v, [etapa.corte]: e.target.value }))}
                    className="numeros"
                  />
                </Campo>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-linha/70 bg-superficie-2/50 p-4">
          <legend className="px-1 text-sm font-semibold text-tinta">Notas por disciplina</legend>
          <p className="mb-3 text-sm text-tinta-suave">Preencha só as disciplinas que esta prova teve. No total, coloque o número de questões ou de pontos da disciplina.</p>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-x-3 gap-y-2">
            <span className="text-xs font-medium text-tinta-suave">Disciplina</span>
            <span className="text-xs font-medium text-tinta-suave">Minha nota</span>
            <span className="text-xs font-medium text-tinta-suave">Total</span>
            {disciplinas.map((l, i) => (
              <div key={i} className="contents">
                {l.nova ? (
                  <Entrada aria-label="Nome da disciplina" value={l.nome} maxLength={60} placeholder="Nome da disciplina" onChange={(e) => mudarDisciplina(i, { nome: e.target.value })} />
                ) : (
                  <span className="truncate text-[15px] text-tinta">{l.nome}</span>
                )}
                <Entrada aria-label={`Minha nota em ${l.nome || 'nova disciplina'}`} inputMode="decimal" value={l.nota} onChange={(e) => mudarDisciplina(i, { nota: e.target.value })} className="numeros" />
                <Entrada aria-label={`Total de ${l.nome || 'nova disciplina'}`} inputMode="decimal" value={l.total} onChange={(e) => mudarDisciplina(i, { total: e.target.value })} className="numeros" />
              </div>
            ))}
          </div>
          <Botao type="button" variante="secundario" tamanho="sm" className="mt-3" onClick={() => setDisciplinas((v) => [...v, { nome: '', nota: '', total: '', nova: true }])}>
            <Plus className="size-4" aria-hidden /> Outra disciplina
          </Botao>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Campo rotulo="Situação (opcional)" htmlFor="pf-situacao">
            <Selecao id="pf-situacao" value={f.situacao} onChange={campo('situacao')}>
              <option value="">Não informar</option>
              {(Object.keys(ROTULO_SITUACAO) as SituacaoProva[]).map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SITUACAO[s]}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Classificação (opcional)" htmlFor="pf-classificacao">
            <Entrada id="pf-classificacao" inputMode="numeric" value={f.classificacao} placeholder="Ex.: 42" onChange={campo('classificacao')} className="numeros" />
          </Campo>
        </div>
        <Campo rotulo="Observação (opcional)" htmlFor="pf-observacao" dica={`${f.observacao.length}/500`}>
          <AreaTexto id="pf-observacao" value={f.observacao} maxLength={500} placeholder="O que pesou na prova, o que faria diferente…" onChange={campo('observacao')} />
        </Campo>

        {erro && (
          <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            {prova ? 'Salvar alterações' : 'Adicionar prova'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
