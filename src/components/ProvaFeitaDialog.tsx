import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useProvasFeitas, useSalvarProvaFeita } from '@/hooks/dados'
import { chaveDisciplina, disciplinasConhecidas, formatarNota, lerNota, ROTULO_SITUACAO } from '@/lib/provasFeitas'
import { mensagemErro } from '@/lib/utils'
import type { NotaDisciplina, ProvaFeita, SituacaoProva, TipoProvaFeita } from '@/types'
import { Botao, Campo, Dialogo, Entrada, Selecao } from './ui'

const VAZIO = { nome: '', cargo: '', banca: '', data: '', total: '', corte: '', situacao: '', classificacao: '' }

/** Linha do formulário de disciplinas; `nova` = nome digitado pelo usuário */
interface LinhaDisciplina {
  nome: string
  nota: string
  total: string
  nova?: boolean
}

/** Rótulos do formulário para prova e para simulado (os campos são os mesmos, menos a situação) */
const TEXTOS = {
  prova: {
    novo: 'Adicionar prova feita',
    editar: 'Editar prova',
    descricao: 'Preencha só o que você tiver. Só o concurso e a data são obrigatórios.',
    nome: 'Concurso',
    exemploNome: 'Ex.: TRT 8',
    semNome: 'Diga de qual concurso foi a prova.',
    semData: 'Escolha a data da prova.',
    data: 'Data da prova',
    cargo: 'Cargo (opcional)',
    exemploCargo: 'Ex.: Técnico judiciário',
    banca: 'Banca (opcional)',
    exemploBanca: 'Ex.: FCC',
    disciplinas: 'Preencha só as disciplinas que esta prova teve.',
    adicionar: 'Adicionar prova',
    adicionada: 'Prova adicionada.',
    atualizada: 'Prova atualizada.',
  },
  simulado: {
    novo: 'Adicionar simulado',
    editar: 'Editar simulado',
    descricao: 'Preencha só o que você tiver. Só o nome e a data são obrigatórios.',
    nome: 'Simulado',
    exemploNome: 'Ex.: Simulado 3',
    semNome: 'Dê um nome ao simulado.',
    semData: 'Escolha a data do simulado.',
    data: 'Data',
    cargo: 'Concurso que você está treinando (opcional)',
    exemploCargo: 'Ex.: TRT 8',
    banca: 'Curso ou banca (opcional)',
    exemploBanca: 'Ex.: Estratégia',
    disciplinas: 'Preencha só as disciplinas que este simulado teve.',
    adicionar: 'Adicionar simulado',
    adicionada: 'Simulado adicionado.',
    atualizada: 'Simulado atualizado.',
  },
} satisfies Record<TipoProvaFeita, Record<string, string>>

/** Adicionar ou editar uma prova já feita (ou um simulado): nome, data, nota de cada disciplina e o resultado */
export function ProvaFeitaDialog({ aberto, aoMudar, prova, tipo = 'prova' }: { aberto: boolean; aoMudar: (a: boolean) => void; prova: ProvaFeita | null; tipo?: TipoProvaFeita }) {
  const tx = TEXTOS[tipo]
  const salvar = useSalvarProvaFeita()
  const todas = useProvasFeitas()
  const [f, setF] = useState(VAZIO)
  const [disciplinas, setDisciplinas] = useState<LinhaDisciplina[]>([])
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
            total: prova.nota_final === null ? '' : formatarNota(prova.nota_final),
            corte: prova.corte_final === null ? '' : formatarNota(prova.corte_final),
            situacao: prova.situacao ?? '',
            classificacao: prova.classificacao ? String(prova.classificacao) : '',
          }
        : VAZIO,
    )
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

  const campo = (chave: keyof typeof VAZIO) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [chave]: e.target.value }))
  const mudarDisciplina = (i: number, parte: Partial<LinhaDisciplina>) => setDisciplinas((v) => v.map((l, j) => (j === i ? { ...l, ...parte } : l)))

  // ajuda a conferir a pontuação total (as disciplinas podem ter pesos, então é só uma referência)
  const notasValidas = disciplinas.map((l) => lerNota(l.nota)).filter((n): n is number => n !== null && !Number.isNaN(n))
  const soma = notasValidas.length ? Math.round(notasValidas.reduce((s, n) => s + n, 0) * 100) / 100 : null

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!f.nome.trim()) return setErro(tx.semNome)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return setErro(tx.semData)
    const porDisciplina: NotaDisciplina[] = []
    for (const l of disciplinas) {
      const nome = l.nome.trim()
      const nota = lerNota(l.nota)
      const total = lerNota(l.total)
      if (nota === null && total === null) continue
      if (!nome) return setErro('Dê um nome à disciplina que você adicionou, ou apague as notas dela.')
      if (nota === null) return setErro(`Falta a sua nota em ${nome} (ou apague o total).`)
      if (Number.isNaN(nota) || Number.isNaN(total) || total === 0) return setErro(`Confira os números de ${nome}: só números, com até duas casas (ex.: 7,5).`)
      if (total !== null && nota > total) return setErro(`Em ${nome}, a nota não pode passar do total.`)
      if (porDisciplina.some((d) => chaveDisciplina(d.nome) === chaveDisciplina(nome))) return setErro(`${nome} aparece duas vezes.`)
      porDisciplina.push({ nome, nota, total })
    }
    const total = lerNota(f.total)
    const corte = lerNota(f.corte)
    if (Number.isNaN(total) || Number.isNaN(corte)) return setErro('Confira a pontuação total e a nota de corte: só números, com até duas casas (ex.: 72,5).')
    const classificacao = f.classificacao.trim() ? Number(f.classificacao) : null
    if (classificacao !== null && (!Number.isInteger(classificacao) || classificacao < 1)) return setErro('A classificação é a sua posição: um número inteiro a partir de 1.')
    try {
      await salvar.mutateAsync({
        id: prova?.id,
        tipo,
        nome: f.nome.trim(),
        cargo: f.cargo.trim() || null,
        banca: f.banca.trim() || null,
        data: f.data,
        disciplinas: porDisciplina,
        nota_final: total,
        corte_final: corte,
        classificacao,
        situacao: tipo === 'prova' ? ((f.situacao || null) as SituacaoProva | null) : null,
      })
      toast.success(prova ? tx.atualizada : tx.adicionada)
      aoMudar(false)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      titulo={prova ? tx.editar : tx.novo}
      descricao={tx.descricao}
      largura="max-w-2xl"
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Campo rotulo={tx.nome} htmlFor="pf-nome">
            <Entrada id="pf-nome" value={f.nome} maxLength={120} placeholder={tx.exemploNome} onChange={campo('nome')} />
          </Campo>
          <Campo rotulo={tx.data} htmlFor="pf-data">
            <Entrada id="pf-data" type="date" value={f.data} onChange={campo('data')} className="numeros" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo rotulo={tx.cargo} htmlFor="pf-cargo">
            <Entrada id="pf-cargo" value={f.cargo} maxLength={120} placeholder={tx.exemploCargo} onChange={campo('cargo')} />
          </Campo>
          <Campo rotulo={tx.banca} htmlFor="pf-banca">
            <Entrada id="pf-banca" value={f.banca} maxLength={80} placeholder={tx.exemploBanca} onChange={campo('banca')} />
          </Campo>
        </div>

        <fieldset className="rounded-xl border border-linha/70 bg-superficie-2/50 p-4">
          <legend className="px-1 text-sm font-semibold text-tinta">Notas por disciplina</legend>
          <p className="mb-3 text-sm text-tinta-suave">{tx.disciplinas} O total é quanto a disciplina valia (questões ou pontos); com ele a comparação mostra o seu aproveitamento.</p>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo rotulo="Pontuação total" htmlFor="pf-total" dica={soma === null ? undefined : `Soma das disciplinas: ${formatarNota(soma)}`}>
            <Entrada id="pf-total" inputMode="decimal" value={f.total} onChange={campo('total')} className="numeros" />
          </Campo>
          <Campo rotulo="Nota de corte" htmlFor="pf-corte">
            <Entrada id="pf-corte" inputMode="decimal" value={f.corte} onChange={campo('corte')} className="numeros" />
          </Campo>
          <Campo rotulo="Classificação" htmlFor="pf-classificacao">
            <Entrada id="pf-classificacao" inputMode="numeric" value={f.classificacao} placeholder="Ex.: 42" onChange={campo('classificacao')} className="numeros" />
          </Campo>
          {tipo === 'prova' && (
          <Campo rotulo="Situação" htmlFor="pf-situacao">
            <Selecao id="pf-situacao" value={f.situacao} onChange={campo('situacao')}>
              <option value="">Não informar</option>
              {(Object.keys(ROTULO_SITUACAO) as SituacaoProva[]).map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SITUACAO[s]}
                </option>
              ))}
            </Selecao>
          </Campo>
          )}
        </div>

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
            {prova ? 'Salvar alterações' : tx.adicionar}
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
