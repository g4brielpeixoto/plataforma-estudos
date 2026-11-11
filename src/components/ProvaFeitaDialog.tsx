import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useSalvarProvaFeita } from '@/hooks/dados'
import { formatarNota, lerNota, ROTULO_SITUACAO } from '@/lib/provasFeitas'
import { mensagemErro } from '@/lib/utils'
import type { ProvaFeita, SituacaoProva } from '@/types'
import { AreaTexto, Botao, Campo, Dialogo, Entrada, Selecao } from './ui'

const NOTAS = ['nota_objetiva', 'corte_objetiva', 'nota_discursiva', 'corte_discursiva', 'nota_final', 'corte_final'] as const
type CampoNota = (typeof NOTAS)[number]

const ETAPAS: { titulo: string; nota: CampoNota; corte: CampoNota }[] = [
  { titulo: 'Objetiva', nota: 'nota_objetiva', corte: 'corte_objetiva' },
  { titulo: 'Discursiva', nota: 'nota_discursiva', corte: 'corte_discursiva' },
  { titulo: 'Nota final', nota: 'nota_final', corte: 'corte_final' },
]

const VAZIO = { nome: '', cargo: '', banca: '', data: '', situacao: '', classificacao: '', observacao: '' }
const NOTAS_VAZIAS = Object.fromEntries(NOTAS.map((c) => [c, ''])) as Record<CampoNota, string>

/** Adicionar ou editar uma prova já feita: concurso, data, notas e cortes de cada etapa, situação */
export function ProvaFeitaDialog({ aberto, aoMudar, prova }: { aberto: boolean; aoMudar: (a: boolean) => void; prova: ProvaFeita | null }) {
  const salvar = useSalvarProvaFeita()
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
  }, [aberto, prova])

  const campo = (chave: keyof typeof VAZIO) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [chave]: e.target.value }))

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!f.nome.trim()) return setErro('Diga de qual concurso foi a prova.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return setErro('Escolha a data da prova.')
    const lidas = Object.fromEntries(NOTAS.map((c) => [c, lerNota(notas[c])])) as Record<CampoNota, number | null>
    if (NOTAS.some((c) => Number.isNaN(lidas[c]))) return setErro('Confira as notas: use só números, com até duas casas (ex.: 72,5).')
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
