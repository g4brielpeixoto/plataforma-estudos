import { Check, ChevronDown, LoaderCircle, Plus, Search } from 'lucide-react'
import { forwardRef, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { useCriarTopico } from '@/hooks/dados'
import { filtrarBusca, itensDeBusca } from '@/lib/buscaTopicos'
import { numeracaoDeTodos } from '@/lib/topicos'
import { cn, mensagemErro } from '@/lib/utils'
import type { Disciplina, Topico } from '@/types'
import { campoBase, Dialogo, Entrada } from './ui'

interface Props {
  id?: string
  /** todos os tópicos (a numeração é a do edital) */
  topicos: Topico[]
  disciplinas: Disciplina[]
  /** limita a busca a uma disciplina ('' = todas; escolher um tópico de outra disciplina troca a disciplina) */
  disciplinaId: string
  valor: string
  aoEscolher: (t: Topico | null) => void
  placeholder?: string
  /** texto da opção "nenhum tópico"; sem ele, a opção não aparece */
  opcaoVazia?: string
  rotulo?: string
  disabled?: boolean
  invalido?: boolean
  className?: string
}

/**
  Campo de tópico com busca: toca e abre uma janela onde dá para digitar parte do nome
  ou o número do edital (4, 4.2…). Setas e Enter também funcionam.
*/
export const SeletorTopico = forwardRef<HTMLButtonElement, Props>(function SeletorTopico(
  { id, topicos, disciplinas, disciplinaId, valor, aoEscolher, placeholder = 'Escolha…', opcaoVazia, rotulo = 'Tópico', disabled, invalido, className },
  ref,
) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [todas, setTodas] = useState(false)
  const lista = useRef<HTMLUListElement>(null)
  const busca = useRef<HTMLInputElement>(null)
  const idLista = useId()

  const selecionado = topicos.find((t) => t.id === valor)
  const numero = selecionado ? numeracaoDeTodos(topicos).get(selecionado.id) : undefined
  const escopo = todas ? '' : disciplinaId
  const nomeDisciplina = new Map(disciplinas.map((d) => [d.id, d]))

  const itens = useMemo(() => itensDeBusca(topicos, escopo || null, disciplinas.map((d) => d.id)), [topicos, escopo, disciplinas])
  const filtrados = useMemo(() => filtrarBusca(itens, termo), [itens, termo])
  // "nenhum tópico" vem primeiro quando não há busca
  const comVazio = opcaoVazia && !termo.trim()
  // tópico novo: o que foi digitado vira um tópico no fim da disciplina do campo (se ainda não existe um com esse nome)
  const criar = useCriarTopico()
  const novoNome = termo.trim().replace(/\s+/g, ' ')
  const jaExiste = !!novoNome && topicos.some((t) => t.disciplina_id === disciplinaId && t.nome.trim().toLowerCase() === novoNome.toLowerCase())
  const podeCriar = !!disciplinaId && novoNome.length > 0 && novoNome.length <= 300 && !jaExiste
  const indiceCriar = filtrados.length + (comVazio ? 1 : 0)
  const total = indiceCriar + (podeCriar ? 1 : 0)

  const criarTopico = async () => {
    if (!podeCriar || criar.isPending) return
    try {
      const novo = await criar.mutateAsync({ disciplina_id: disciplinaId, nome: novoNome })
      toast.success(`Tópico adicionado em ${nomeDisciplina.get(disciplinaId)?.nome ?? 'sua disciplina'}.`)
      escolher(novo)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  useEffect(() => {
    if (!aberto) return
    setTermo('')
    setTodas(false)
  }, [aberto])
  useEffect(() => {
    // começa no tópico escolhido (ou no primeiro)
    const i = filtrados.findIndex((x) => x.topico.id === valor)
    setAtivo(i >= 0 && !termo ? i + (comVazio ? 1 : 0) : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, escopo, aberto])
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  const escolher = (t: Topico | null) => {
    aoEscolher(t)
    setAberto(false)
  }

  const teclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAtivo((a) => Math.min(total - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (comVazio && ativo === 0) return escolher(null)
      if (podeCriar && ativo === indiceCriar) return void criarTopico()
      const item = filtrados[ativo - (comVazio ? 1 : 0)]
      if (item) escolher(item.topico)
    }
  }

  const idOpcao = (i: number) => `${idLista}-${i}`

  return (
    <>
      <button
        ref={ref}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-label={selecionado ? `${rotulo}: ${numero ?? ''} ${selecionado.nome}. Toque para trocar` : `${rotulo}: ${placeholder}`}
        className={cn(campoBase, 'flex h-10 items-center gap-2 text-left', invalido && 'border-ruim', className)}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selecionado && 'text-tinta-suave/80')}>
          {selecionado ? (
            <>
              {numero && <span className="mr-1.5 font-semibold text-tinta-suave numeros">{numero}</span>}
              {selecionado.nome}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-primaria" aria-hidden />
      </button>

      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={`Escolher ${rotulo.toLowerCase()}`}
        descricao={escopo ? (nomeDisciplina.get(escopo)?.nome ?? undefined) : 'Todas as disciplinas'}
        largura="max-w-xl"
        focoInicial={busca}
        sobreposto
        noTopo
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
          <Entrada
            ref={busca}
            role="combobox"
            aria-expanded
            aria-controls={idLista}
            aria-activedescendant={total ? idOpcao(ativo) : undefined}
            aria-autocomplete="list"
            aria-label="Buscar tópico por nome ou número"
            placeholder="Buscar por nome ou número (ex.: 4.2)"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={teclar}
            className="pl-9"
            enterKeyHint="go"
          />
        </div>
        {disciplinaId && (
          <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 text-sm font-medium text-primaria-forte hover:underline dark:text-primaria">
            {todas ? 'Buscar só nesta disciplina' : 'Buscar em todas as disciplinas'}
          </button>
        )}

        <ul ref={lista} id={idLista} role="listbox" aria-label="Tópicos" className="-mx-2 mt-3 max-h-[42dvh] overflow-y-auto px-1 sm:max-h-[60vh]">
          {comVazio && (
            <li
              id={idOpcao(0)}
              data-indice={0}
              role="option"
              aria-selected={!valor}
              onClick={() => escolher(null)}
              onMouseMove={() => setAtivo(0)}
              className={cn('flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] text-tinta-suave', ativo === 0 && 'bg-nevoa/60')}
            >
              <span className="flex-1">{opcaoVazia}</span>
              {!valor && <Check className="size-4 text-primaria" aria-hidden />}
            </li>
          )}
          {filtrados.map((x, i) => {
            const indice = i + (comVazio ? 1 : 0)
            const t = x.topico
            const mudaDisciplina = !escopo && (i === 0 || filtrados[i - 1].topico.disciplina_id !== t.disciplina_id)
            const d = nomeDisciplina.get(t.disciplina_id)
            return (
              <li key={t.id} role="presentation">
                {mudaDisciplina && d && (
                  <p className="flex items-center gap-2 px-3 pt-3 pb-1 text-xs font-semibold text-tinta-suave" aria-hidden>
                    <span className="size-2 rounded-full" style={{ background: d.cor }} />
                    {d.nome}
                  </p>
                )}
                <div
                  id={idOpcao(indice)}
                  data-indice={indice}
                  role="option"
                  aria-selected={t.id === valor}
                  onClick={() => escolher(t)}
                  onMouseMove={() => setAtivo(indice)}
                  className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2', ativo === indice && 'bg-nevoa/60')}
                  style={{ paddingLeft: `calc(0.75rem + ${termo.trim() ? 0 : t.nivel} * var(--recuo-nivel))` }}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-6 shrink-0 place-items-center rounded-md px-1.5 text-xs font-semibold text-tinta-suave numeros',
                      t.nivel === 0 ? 'min-w-7 bg-superficie-2' : 'min-w-8 ring-1 ring-linha ring-inset',
                    )}
                  >
                    {x.numero}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[15px] leading-snug [overflow-wrap:anywhere]', t.concluido ? 'text-tinta-suave' : 'text-tinta')}>{t.nome}</span>
                    {termo.trim() && x.pai && <span className="block truncate text-xs text-tinta-suave">dentro de {x.pai}</span>}
                  </span>
                  {t.concluido && <span className="mt-0.5 shrink-0 text-xs text-visto-texto">concluído</span>}
                  {t.id === valor && <Check className="mt-1 size-4 shrink-0 text-primaria" aria-hidden />}
                </div>
              </li>
            )
          })}
          {filtrados.length === 0 && !comVazio && (
            <li className="px-3 py-6 text-center text-sm text-tinta-suave">
              {itens.length === 0 ? 'Esta disciplina ainda não tem tópicos.' : `Nenhum tópico com "${termo.trim()}".`}
              {!disciplinaId && termo.trim() && ' Para adicionar um novo, escolha antes a disciplina.'}
            </li>
          )}
          {podeCriar && (
            <li
              id={idOpcao(indiceCriar)}
              data-indice={indiceCriar}
              role="option"
              aria-selected={false}
              aria-disabled={criar.isPending}
              onClick={() => void criarTopico()}
              onMouseMove={() => setAtivo(indiceCriar)}
              className={cn(
                'mt-1 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-lilas px-3 py-2.5 text-[15px] text-tinta',
                ativo === indiceCriar && 'bg-nevoa/60',
                criar.isPending && 'opacity-60',
              )}
            >
              {criar.isPending ? <LoaderCircle className="size-4 shrink-0 animate-spin text-primaria" aria-hidden /> : <Plus className="size-4 shrink-0 text-primaria" aria-hidden />}
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                Adicionar <strong className="font-semibold">“{novoNome}”</strong>
                <span className="text-tinta-suave"> em {nomeDisciplina.get(disciplinaId)?.nome ?? 'sua disciplina'}</span>
              </span>
            </li>
          )}
        </ul>
      </Dialogo>
    </>
  )
})
