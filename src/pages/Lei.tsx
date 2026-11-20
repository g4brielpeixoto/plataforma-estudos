import * as Menu from '@radix-ui/react-dropdown-menu'
import { format } from 'date-fns'
import { ArrowDown, ArrowDown01, ArrowLeft, ArrowUp, ChevronRight, ChevronsDownUp, ChevronsUpDown, CornerDownRight, EllipsisVertical, FileUp, Flag, IndentDecrease, IndentIncrease, Layers, Pilcrow, LoaderCircle, Menu as IconeMenu, Pencil, Plus, Trash2 } from 'lucide-react'
import { cloneElement, memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { CampoRico, type CampoRicoRef } from '@/components/flashcards/CampoRico'
import { NotaFlashDialog } from '@/components/flashcards/NotaFlashDialog'
import { ImportarLeiDialog } from '@/components/leis/ImportarLeiDialog'
import { LeiDialog } from '@/components/leis/LeiDialog'
import { SumarioLei } from '@/components/leis/SumarioLei'
import { Botao, Carregando, Confirmar, Dialogo, Painel, Vazio } from '@/components/ui'
import { useExcluirNotasFlash, useLeis, useSalvarNotaFlash } from '@/hooks/dados'
import { useEditorLei } from '@/hooks/useEditorLei'
import { useDadosFlash } from '@/hooks/useFlash'
import { contagem } from '@/lib/flashcards/fila'
import { limparHtml, textoParaHtml, textoPuro, vazio } from '@/lib/flashcards/html'
import { numerosOmissao } from '@/lib/flashcards/omissao'
import {
  ancestrais,
  avancarLinha,
  cartaoDaLinha,
  COR_INCIDENCIA,
  descendentes,
  entradasDoSumario,
  INCIDENCIAS,
  inserirDepois,
  linhaParaExibir,
  linhasDoFiltro,
  moverLinha,
  NIVEL_MAXIMO_LEI,
  recuarLinha,
  removerLinha,
  resumirLei,
  ROTULO_INCIDENCIA,
  temFilhos,
  encaixarArtigo,
  numeroDoArtigo,
  ordenarPorArtigo,
  type FiltroLei,
  type LinhaImportada,
} from '@/lib/leis'
import { cn, mensagemErro } from '@/lib/utils'
import type { FlashNota, Incidencia, LeiLinha } from '@/types'

type Acao = 'sair' | 'enter' | 'apagar' | 'recuar' | 'avancar' | 'cima' | 'baixo'

const FILTROS: [FiltroLei, string][] = [
  ['tudo', 'Tudo'],
  ['alta', 'Alta'],
  ['alta-media', 'Alta e média'],
  ['pendentes', 'Não revisados'],
]

function lerConjunto(chave: string) {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(chave) ?? '[]'))
  } catch {
    return new Set<string>()
  }
}
function guardar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    /* sem armazenamento: só não fica salvo */
  }
}

/** Uma lei: anotações em linhas encaixadas, incidência de cada artigo, sumário e flashcards criados das linhas */
export function PaginaLei() {
  const { id } = useParams()
  const [busca, setBusca] = useSearchParams()
  const navegar = useNavigate()
  const leis = useLeis()
  const flash = useDadosFlash()
  const salvarNota = useSalvarNotaFlash()
  const excluirNotas = useExcluirNotasFlash()
  const { linhas, mudar, pendente } = useEditorLei(id)

  const lei = leis.data?.find((l) => l.id === id)
  const disciplina = lei ? flash.disciplinaPorId.get(lei.disciplina_id) : undefined

  const [editando, setEditandoEstado] = useState<string | null>(null)
  const editandoRef = useRef<string | null>(null)
  const abertura = useRef<{ id: string; texto: string; ponto?: { x: number; y: number } } | null>(null)
  const [filtro, setFiltro] = useState<FiltroLei>('tudo')
  const [recolhidas, setRecolhidasEstado] = useState<Set<string>>(new Set())
  const [sumarioAberto, setSumarioAberto] = useState(() => {
    try {
      return localStorage.getItem('lei:sumario') !== '0'
    } catch {
      return true
    }
  })
  const [sumarioCelular, setSumarioCelular] = useState(false)
  // texto com cara de lei: primeira linha de cada parágrafo recuada e texto justificado
  const [recuo, setRecuo] = useState(() => {
    try {
      return localStorage.getItem('lei:recuo') === '1'
    } catch {
      return false
    }
  })
  const [ativa, setAtiva] = useState<string | null>(null)
  const [destaque, setDestaque] = useState<string | null>(null)
  const [editandoLei, setEditandoLei] = useState(false)
  const [importando, setImportando] = useState(false)
  const [excluindo, setExcluindo] = useState<LeiLinha | null>(null)
  const [orfao, setOrfao] = useState<LeiLinha | null>(null)
  const [cartaoDe, setCartaoDe] = useState<{ linha: LeiLinha; nota: FlashNota | null } | null>(null)

  const linhasRef = useRef<LeiLinha[]>([])
  linhasRef.current = linhas ?? []
  const filaCartoes = useRef<Promise<unknown>>(Promise.resolve())
  const acoes = useRef<AcoesDaLinha>(null!)

  useEffect(() => {
    setRecolhidasEstado(lerConjunto(`lei:recolhidas:${id}`))
    setEditando(null)
    setFiltro('tudo')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const setRecolhidas = (novo: Set<string>) => {
    setRecolhidasEstado(novo)
    guardar(`lei:recolhidas:${id}`, JSON.stringify([...novo]))
  }

  const setEditando = (linhaId: string | null, ponto?: { x: number; y: number }) => {
    editandoRef.current = linhaId
    const l = linhaId ? linhasRef.current.find((x) => x.id === linhaId) : undefined
    abertura.current = linhaId ? { id: linhaId, texto: l?.texto ?? '', ponto } : null
    setEditandoEstado(linhaId)
  }

  // ---------- o que aparece ----------
  const todas = useMemo(() => linhas ?? [], [linhas])
  const comFilhos = useMemo(() => new Set(todas.filter((_, i) => temFilhos(todas, i)).map((l) => l.id)), [todas])
  const visiveis = useMemo(() => {
    const doFiltro = linhasDoFiltro(todas, filtro)
    const fora = new Set<string>()
    for (const rid of recolhidas) if (comFilhos.has(rid)) for (const d of descendentes(todas, rid)) fora.add(d.id)
    return doFiltro.filter((l) => !fora.has(l.id))
  }, [todas, filtro, recolhidas, comFilhos])
  const linhaPorId = useMemo(() => new Map(todas.map((l) => [l.id, l])), [todas])
  const entradas = useMemo(() => entradasDoSumario(todas), [todas])
  const resumo = useMemo(() => resumirLei(todas), [todas])
  const algumaRecolhida = [...recolhidas].some((r) => comFilhos.has(r))
  const foraDeOrdem = useMemo(() => ordenarPorArtigo(todas) !== todas, [todas])

  // flashcards desta lei que dá para estudar hoje
  const notasDaLei = useMemo(() => new Set(todas.map((l) => l.nota_id).filter((x): x is string => !!x)), [todas])
  const paraHoje = useMemo(() => {
    if (!notasDaLei.size) return 0
    const c = contagem(flash.disponiveisEm((n) => notasDaLei.has(n.id)))
    return c.novos + c.aprendendo + c.revisar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notasDaLei, flash.cartoes, flash.feitos])

  // ---------- ir até uma linha (sumário, link do flashcard) ----------
  const travaAtiva = useRef(0)
  const irPara = useCallback(
    (linhaId: string) => {
      const lista = linhasRef.current
      if (!lista.some((l) => l.id === linhaId)) return
      setFiltro('tudo')
      const acima = new Set(ancestrais(lista, linhaId).map((a) => a.id))
      setRecolhidasEstado((r) => ([...r].some((x) => acima.has(x)) ? new Set([...r].filter((x) => !acima.has(x))) : r))
      setSumarioCelular(false)
      setDestaque(linhaId)
      setAtiva(linhaId)
      // enquanto a tela rola até lá, o sumário fica na linha escolhida
      travaAtiva.current = Date.now() + 1500
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          document.querySelector(`[data-linha="${linhaId}"]`)?.scrollIntoView({ block: 'start', behavior: reduz ? 'auto' : 'smooth' })
        }),
      )
      window.setTimeout(() => setDestaque((d) => (d === linhaId ? null : d)), 2200)
    },
    [],
  )

  // chegou com ?linha= (vindo da revisão de um flashcard)
  const alvo = busca.get('linha')
  useEffect(() => {
    if (!alvo || !linhas) return
    irPara(alvo)
    setBusca({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo, !!linhas])

  // qual entrada do sumário está na tela
  useEffect(() => {
    if (!entradas.length) return
    let quadro = 0
    let espera = 0
    const medir = () => {
      quadro = 0
      const falta = travaAtiva.current - Date.now()
      if (falta > 0) {
        // mede de novo quando a trava do clique no sumário acabar
        if (!espera) espera = window.setTimeout(() => ((espera = 0), medir()), falta + 30)
        return
      }
      let atual: string | null = null
      for (const e of entradas) {
        const el = document.querySelector(`[data-linha="${e.id}"]`)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 150) atual = e.id
        else break
      }
      setAtiva((a) => atual ?? a ?? entradas[0]?.id ?? null)
    }
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener('scroll', aoRolar, true)
    return () => {
      window.removeEventListener('scroll', aoRolar, true)
      if (quadro) cancelAnimationFrame(quadro)
      if (espera) window.clearTimeout(espera)
    }
  }, [entradas])

  // ---------- flashcard a partir da linha ----------
  const notaExiste = (notaId: string | null) => !!notaId && flash.notaPorId.has(notaId)
  const flashRef = useRef(flash)
  flashRef.current = flash

  /** Depois de editar a linha: cria ou atualiza o cartão escrito nela ("pergunta >> resposta" ou omissão) */
  const acertarCartao = (linhaId: string, antes: string, depois: string) => {
    if (!lei) return
    const novo = cartaoDaLinha(depois)
    const velho = cartaoDaLinha(antes)
    if (!novo && !velho) return
    filaCartoes.current = filaCartoes.current.then(async () => {
      const linha = linhasRef.current.find((l) => l.id === linhaId)
      if (!linha) return
      const nota = linha.nota_id ? flashRef.current.notaPorId.get(linha.nota_id) : undefined
      if (!novo) {
        // a linha tinha um cartão escrito e não tem mais: pergunta o que fazer com ele
        if (nota) setOrfao(linha)
        return
      }
      const frente = limparHtml(novo.frente)
      const verso = limparHtml(novo.verso)
      if (nota && nota.tipo === novo.tipo && nota.frente === frente && nota.verso === verso) return
      try {
        const notaId = await salvarNota.mutateAsync({
          id: nota?.id,
          dados: { disciplina_id: nota?.disciplina_id ?? lei.disciplina_id, topico_id: nota?.topico_id ?? null, tipo: novo.tipo, frente, verso },
          ordens: novo.tipo === 'omissao' ? numerosOmissao(frente) : [0],
          posicao: flashRef.current.cartoes.reduce((m, c) => Math.max(m, c.posicao), 0) + 1,
        })
        if (!nota) {
          mudar((a) => a.map((l) => (l.id === linhaId ? { ...l, nota_id: notaId } : l)))
          toast.success('Flashcard criado a partir da linha.')
        }
      } catch (e) {
        toast.error(`Não foi possível salvar o flashcard da linha: ${mensagemErro(e)}`)
      }
    })
  }

  // ---------- edição ----------
  const novaLinha = (depoisDe: string | null, dentro = false) => {
    if (!id) return
    const nova: LeiLinha = { id: crypto.randomUUID(), lei_id: id, ordem: 0, nivel: 0, texto: '', incidencia: null, revisado_em: null, nota_id: null }
    mudar((a) => {
      if (dentro && depoisDe) {
        const i = a.findIndex((l) => l.id === depoisDe)
        if (i >= 0) return [...a.slice(0, i + 1), { ...nova, nivel: Math.min(a[i].nivel + 1, NIVEL_MAXIMO_LEI) }, ...a.slice(i + 1)]
      }
      return inserirDepois(a, depoisDe, nova)
    })
    if (depoisDe && recolhidas.has(depoisDe)) setRecolhidas(new Set([...recolhidas].filter((x) => x !== depoisDe)))
    linhasRef.current = [...linhasRef.current, nova]
    setEditando(nova.id)
  }

  const aoAcao = (linhaId: string, html: string, acao: Acao) => {
    const lista = linhasRef.current
    const i = lista.findIndex((l) => l.id === linhaId)
    if (i < 0) return
    const linha = lista[i]
    if (acao === 'recuar') return mudar((a) => recuarLinha(a, linhaId))
    if (acao === 'avancar') return mudar((a) => avancarLinha(a, linhaId))
    if (acao === 'cima' || acao === 'baixo') return mudar((a) => moverLinha(a, linhaId, acao === 'cima' ? -1 : 1))
    if (editandoRef.current !== linhaId) return
    const texto = limparHtml(html)
    const antes = abertura.current?.id === linhaId ? abertura.current.texto : linha.texto
    const removivel = vazio(texto) && !temFilhos(lista, i) && !notaExiste(linha.nota_id)
    if (acao === 'apagar' && !removivel) return
    if (removivel) {
      // linha em branco não fica guardada
      const k = visiveis.findIndex((l) => l.id === linhaId)
      const anterior = k > 0 ? visiveis[k - 1] : null
      mudar((a) => removerLinha(a, linhaId))
      linhasRef.current = lista.filter((l) => l.id !== linhaId)
      setEditando(acao === 'apagar' ? (anterior?.id ?? null) : null)
      return
    }
    if (texto !== linha.texto) mudar((a) => a.map((l) => (l.id === linhaId ? { ...l, texto } : l)))
    acertarCartao(linhaId, antes, texto)
    // artigo novo (ou com o número trocado) vai para o lugar dele entre os artigos vizinhos
    const numero = numeroDoArtigo(textoPuro(texto))
    const numeroAntes = numeroDoArtigo(textoPuro(antes))
    if (numero !== null && numero !== numeroAntes) {
      // um artigo que já existia leva os parágrafos escritos depois dele; um recém-escrito vai sozinho
      const comSeguintes = numeroAntes !== null
      const comTexto = lista.map((l) => (l.id === linhaId ? { ...l, texto } : l))
      if (encaixarArtigo(comTexto, linhaId, comSeguintes) !== comTexto) {
        mudar((a) => encaixarArtigo(a, linhaId, comSeguintes))
        toast.success('O artigo foi para o lugar dele, na ordem dos números.')
        if (acao !== 'enter') requestAnimationFrame(() => irPara(linhaId))
      }
    }
    if (acao === 'enter') novaLinha(linhaId)
    else setEditando(null)
  }

  const aoRascunho = (linhaId: string, html: string) => {
    const texto = limparHtml(html)
    mudar((a) => (a.some((l) => l.id === linhaId && l.texto !== texto) ? a.map((l) => (l.id === linhaId ? { ...l, texto } : l)) : a))
  }

  const aoColarVarias = (linhaId: string, partes: string[]) => {
    if (!id) return false
    mudar((a) => {
      const i = a.findIndex((l) => l.id === linhaId)
      if (i < 0) return a
      const nivel = temFilhos(a, i) ? Math.min(a[i].nivel + 1, NIVEL_MAXIMO_LEI) : a[i].nivel
      const novas: LeiLinha[] = partes.map((p) => ({ id: crypto.randomUUID(), lei_id: id, ordem: 0, nivel, texto: textoParaHtml(p.trim()), incidencia: null, revisado_em: null, nota_id: null }))
      return [...a.slice(0, i + 1), ...novas, ...a.slice(i + 1)]
    })
    toast.success(`${partes.length} linhas coladas, uma para cada linha do texto.`)
    return true
  }

  const mudarLinha = (linhaId: string, dados: Partial<LeiLinha>) => mudar((a) => a.map((l) => (l.id === linhaId ? { ...l, ...dados } : l)))

  const pedirExclusao = (linha: LeiLinha) => {
    const dentro = descendentes(linhasRef.current, linha.id)
    const comCartao = [linha, ...dentro].some((l) => notaExiste(l.nota_id))
    if (!dentro.length && !comCartao) {
      if (editandoRef.current === linha.id) setEditando(null)
      return mudar((a) => removerLinha(a, linha.id))
    }
    setExcluindo(linha)
  }

  const importar = (novas: LinhaImportada[]) => {
    if (!id) return
    mudar((a) => [...a, ...novas.map((n) => ({ id: crypto.randomUUID(), lei_id: id, ordem: 0, nivel: n.nivel, texto: negritoDoTexto(textoParaHtml(n.texto)), incidencia: n.incidencia, revisado_em: null, nota_id: null }))])
    toast.success(`${novas.length} ${novas.length === 1 ? 'linha importada' : 'linhas importadas'}.`)
  }

  // ações das linhas num objeto estável: as linhas (memo) não precisam redesenhar quando a página muda
  acoes.current = {
    editar: (id, ponto) => setEditando(id, ponto),
    alternarRecolhida: (id) => setRecolhidas(recolhidas.has(id) ? new Set([...recolhidas].filter((x) => x !== id)) : new Set([...recolhidas, id])),
    rascunho: aoRascunho,
    acao: aoAcao,
    colarVarias: aoColarVarias,
    mudarLinha,
    abrirCartao: (l) => setCartaoDe({ linha: l, nota: (l.nota_id ? flash.notaPorId.get(l.nota_id) : undefined) ?? null }),
    novaDentro: (id) => novaLinha(id, true),
    estrutura: (id, tipo) =>
      mudar((a) => (tipo === 'recuar' ? recuarLinha(a, id) : tipo === 'avancar' ? avancarLinha(a, id) : moverLinha(a, id, tipo === 'cima' ? -1 : 1))),
    excluir: pedirExclusao,
  }

  if (leis.isLoading || flash.carregando) return <Carregando />
  if (!lei)
    return (
      <Painel>
        <Vazio titulo="Lei não encontrada" texto="Ela pode ter sido excluída." acao={<Link to="/leis" className="font-semibold text-primaria-forte dark:text-primaria">Voltar para as leis</Link>} />
      </Painel>
    )
  if (!linhas) return <Carregando texto="Abrindo a lei…" />

  const excluindoDentro = excluindo ? descendentes(todas, excluindo.id) : []
  const excluindoNotas = excluindo ? [excluindo, ...excluindoDentro].map((l) => l.nota_id).filter((x): x is string => notaExiste(x)) : []
  const incidenciaDoEstudo = filtro === 'alta' ? 'alta' : filtro === 'alta-media' ? 'alta,media' : ''
  const sumario = (classe: string) => (
    <SumarioLei
      entradas={entradas}
      linhaPorId={linhaPorId}
      ativa={ativa}
      aoIr={irPara}
      aoFechar={() => {
        setSumarioCelular(false)
        setSumarioAberto(false)
        guardar('lei:sumario', '0')
      }}
      className={classe}
    />
  )

  return (
    <>
      <header className="mb-5">
        <Link to="/leis" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Leis
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-[1.85rem] leading-tight font-medium tracking-[-0.01em] text-tinta">
              <span className="size-3 shrink-0 rounded-full" style={{ background: disciplina?.cor }} aria-hidden />
              <span className="min-w-0 break-words">{lei.nome}</span>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-tinta-suave numeros">
              <span>{disciplina?.nome}</span>
              <span>
                · {resumo.mapeados} {resumo.mapeados === 1 ? 'artigo mapeado' : 'artigos mapeados'}
                {resumo.mapeados > 0 && ` · ${resumo.revisados} ${resumo.revisados === 1 ? 'revisado' : 'revisados'}`}
                {resumo.cartoes > 0 && ` · ${resumo.cartoes} ${resumo.cartoes === 1 ? 'flashcard' : 'flashcards'}`}
              </span>
              {pendente && (
                <span className="inline-flex items-center gap-1 text-sm" role="status">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Salvando…
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {resumo.cartoes > 0 && (
              <Botao
                variante={paraHoje ? 'primario' : 'secundario'}
                disabled={!paraHoje}
                title={paraHoje ? undefined : 'Nenhum flashcard desta lei para hoje'}
                onClick={() => navegar(`/flashcards/estudar/${lei.disciplina_id}?lei=${lei.id}${incidenciaDoEstudo ? `&incidencia=${incidenciaDoEstudo}` : ''}`)}
              >
                <Layers className="size-4" aria-hidden /> Estudar flashcards{paraHoje ? ` (${paraHoje})` : ''}
              </Botao>
            )}
            <Botao variante="secundario" onClick={() => setImportando(true)}>
              <FileUp className="size-4" aria-hidden /> Importar lista
            </Botao>
            <Botao variante="secundario" onClick={() => setEditandoLei(true)}>
              <Pencil className="size-4" aria-hidden /> Editar
            </Botao>
          </div>
        </div>
      </header>

      <div className="flex items-start gap-5">
        {sumarioAberto && <div className="sticky top-4 hidden w-60 shrink-0 lg:block xl:w-64">{sumario('max-h-[calc(100dvh-2rem)]')}</div>}

        <Painel className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-linha/70 px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(min-width: 64rem)').matches) {
                  setSumarioAberto(!sumarioAberto)
                  guardar('lei:sumario', sumarioAberto ? '0' : '1')
                } else setSumarioCelular(true)
              }}
              aria-label={sumarioAberto ? 'Esconder o sumário' : 'Mostrar o sumário'}
              aria-pressed={sumarioAberto}
              title="Sumário"
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-tinta-suave hover:bg-superficie-2 hover:text-tinta', sumarioAberto && 'lg:bg-nevoa/70 lg:text-tinta')}
            >
              <IconeMenu className="size-4" aria-hidden /> Sumário
            </button>
            <div role="radiogroup" aria-label="Mostrar" className="inline-flex flex-wrap rounded-xl bg-superficie-2 p-1">
              {FILTROS.map(([v, r]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={filtro === v}
                  onClick={() => setFiltro(v)}
                  className={cn('rounded-lg px-3 py-1 text-sm font-medium transition-colors', filtro === v ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta')}
                >
                  {r}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            {foraDeOrdem && (
              <button
                type="button"
                onClick={() => {
                  mudar((a) => ordenarPorArtigo(a))
                  toast.success('Artigos em ordem.')
                }}
                title="Põe os artigos na ordem dos números (cada um leva o que está dentro dele). Títulos e outras linhas ficam onde estão"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primaria-forte hover:bg-superficie-2 dark:text-primaria"
              >
                <ArrowDown01 className="size-4" aria-hidden /> Ordenar artigos
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setRecuo(!recuo)
                guardar('lei:recuo', recuo ? '0' : '1')
              }}
              aria-pressed={recuo}
              title="Recuo de parágrafo: a primeira linha de cada parágrafo começa mais para dentro e o texto fica justificado, como no texto da lei"
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-tinta-suave hover:bg-superficie-2 hover:text-tinta', recuo && 'bg-nevoa/70 text-tinta')}
            >
              <Pilcrow className="size-4" aria-hidden /> Recuo
            </button>
            {comFilhos.size > 0 && (
              <button
                type="button"
                onClick={() => setRecolhidas(algumaRecolhida ? new Set() : new Set(comFilhos))}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-tinta-suave hover:bg-superficie-2 hover:text-tinta"
              >
                {algumaRecolhida ? <ChevronsUpDown className="size-4" aria-hidden /> : <ChevronsDownUp className="size-4" aria-hidden />}
                {algumaRecolhida ? 'Abrir tudo' : 'Recolher tudo'}
              </button>
            )}
          </div>

          {todas.length === 0 ? (
            <Vazio
              titulo="Esta lei ainda está em branco"
              texto="Escreva um artigo por linha. Enter cria a próxima linha e Tab coloca a linha dentro da de cima."
              acao={
                <div className="flex flex-wrap justify-center gap-2">
                  <Botao onClick={() => novaLinha(null)}>
                    <Plus className="size-4" aria-hidden /> Escrever a primeira linha
                  </Botao>
                  <Botao variante="secundario" onClick={() => setImportando(true)}>
                    Importar uma lista
                  </Botao>
                </div>
              }
            />
          ) : (
            <>
              {visiveis.length === 0 && <p className="px-5 py-8 text-center text-sm text-tinta-suave">Nenhuma linha neste filtro.</p>}
              <ul className="py-2">
                {visiveis.map((l) => {
                  const nota = l.nota_id ? flash.notaPorId.get(l.nota_id) : undefined
                  const cartoes = nota ? (flash.cartoesPorNota.get(nota.id) ?? []) : []
                  const proxima = cartoes.length ? cartoes.map((c) => c.vence_em).sort()[0] : null
                  const novoCartao = cartoes.length > 0 && cartoes.every((c) => c.estado === 0)
                  const temDentro = comFilhos.has(l.id)
                  const recolhida = temDentro && recolhidas.has(l.id)
                  return (
                    <LinhaDaLei
                      key={l.id}
                      l={l}
                      acoes={acoes}
                      editando={editando === l.id}
                      ponto={editando === l.id && abertura.current?.id === l.id ? abertura.current.ponto : undefined}
                      destaque={destaque === l.id}
                      temDentro={temDentro}
                      dentroRecolhidas={recolhida ? descendentes(todas, l.id).length : 0}
                      recuo={recuo}
                      cartao={nota ? (novoCartao ? 'ainda não estudado' : proxima ? `próxima revisão em ${format(new Date(proxima), 'dd/MM/yy')}` : 'criado') : null}
                    />
                  )
                })}
              </ul>
              <div className="border-t border-linha/70 px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  onClick={() => {
                    setFiltro('tudo')
                    novaLinha(null)
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primaria-forte hover:bg-superficie-2 dark:text-primaria"
                >
                  <Plus className="size-4" aria-hidden /> Nova linha
                </button>
                <p className="mt-1.5 px-2.5 text-xs text-tinta-suave">
                  Enter cria a próxima linha · Tab coloca dentro da de cima · escreva <strong className="font-semibold">pergunta &gt;&gt; resposta</strong> ou use Omissão para a linha virar flashcard.
                </p>
              </div>
            </>
          )}
        </Painel>
      </div>

      {/* celular: sumário por cima da tela */}
      {sumarioCelular && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Sumário da lei">
          <div className="h-full w-[min(20rem,85vw)] p-2">{sumario('h-full shadow-2xl')}</div>
          <button type="button" aria-label="Fechar o sumário" className="flex-1 bg-tinta/40" onClick={() => setSumarioCelular(false)} />
        </div>
      )}

      <LeiDialog aberto={editandoLei} aoMudar={setEditandoLei} lei={lei} aoExcluir={() => navegar('/leis')} />
      <ImportarLeiDialog aberto={importando} aoMudar={setImportando} aoImportar={importar} />
      <NotaFlashDialog
        aberto={!!cartaoDe}
        aoMudar={(v) => !v && setCartaoDe(null)}
        nota={cartaoDe?.nota}
        disciplinaInicial={lei.disciplina_id}
        frenteInicial={cartaoDe ? cartaoDe.linha.texto : undefined}
        aoCriar={(notaId) => {
          if (cartaoDe) mudarLinha(cartaoDe.linha.id, { nota_id: notaId })
        }}
      />
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(v) => !v && setExcluindo(null)}
        titulo="Excluir a linha?"
        texto={[
          excluindoDentro.length ? (excluindoDentro.length === 1 ? 'A linha de dentro dela também é apagada.' : `As ${excluindoDentro.length} linhas de dentro dela também são apagadas.`) : '',
          excluindoNotas.length ? `${excluindoNotas.length === 1 ? 'O flashcard criado aqui é apagado' : `Os ${excluindoNotas.length} flashcards criados aqui são apagados`}, com o progresso de revisão.` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        textoBotao="Excluir"
        carregando={excluirNotas.isPending}
        aoConfirmar={async () => {
          if (!excluindo) return
          try {
            if (excluindoNotas.length) await excluirNotas.mutateAsync(excluindoNotas)
            if (editandoRef.current && [excluindo, ...excluindoDentro].some((l) => l.id === editandoRef.current)) setEditando(null)
            mudar((a) => removerLinha(a, excluindo.id))
            setExcluindo(null)
          } catch (e) {
            toast.error(`Não foi possível excluir: ${mensagemErro(e)}`)
          }
        }}
      />
      <Dialogo
        aberto={!!orfao}
        aoMudar={(v) => !v && setOrfao(null)}
        titulo="E o flashcard desta linha?"
        descricao="A linha não tem mais “pergunta >> resposta” nem omissão, mas o flashcard criado a partir dela ainda existe."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" onClick={() => setOrfao(null)}>
            Manter o flashcard
          </Botao>
          <Botao
            className="bg-ruim hover:bg-ruim"
            carregando={excluirNotas.isPending}
            onClick={async () => {
              if (!orfao?.nota_id) return setOrfao(null)
              try {
                await excluirNotas.mutateAsync([orfao.nota_id])
                mudarLinha(orfao.id, { nota_id: null })
                setOrfao(null)
              } catch (e) {
                toast.error(`Não foi possível apagar o flashcard: ${mensagemErro(e)}`)
              }
            }}
          >
            Apagar o flashcard
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}

interface AcoesDaLinha {
  editar: (id: string, ponto?: { x: number; y: number }) => void
  alternarRecolhida: (id: string) => void
  rascunho: (id: string, html: string) => void
  acao: (id: string, html: string, acao: Acao) => void
  colarVarias: (id: string, partes: string[]) => boolean
  mudarLinha: (id: string, dados: Partial<LeiLinha>) => void
  abrirCartao: (l: LeiLinha) => void
  novaDentro: (id: string) => void
  estrutura: (id: string, tipo: 'recuar' | 'avancar' | 'cima' | 'baixo') => void
  excluir: (l: LeiLinha) => void
}

/** Uma linha da lei; só redesenha quando ela mesma muda (leis grandes têm milhares de linhas) */
const LinhaDaLei = memo(function LinhaDaLei({
  l,
  acoes,
  editando,
  ponto,
  destaque,
  temDentro,
  dentroRecolhidas,
  recuo,
  cartao,
}: {
  l: LeiLinha
  acoes: { current: AcoesDaLinha }
  editando: boolean
  ponto?: { x: number; y: number }
  destaque: boolean
  temDentro: boolean
  /** quantas linhas estão escondidas dentro dela (0 = aberta) */
  dentroRecolhidas: number
  recuo: boolean
  /** situação do flashcard da linha, ou null sem flashcard */
  cartao: string | null
}) {
  const recolhida = dentroRecolhidas > 0
  const a = () => acoes.current
  return (
    <li
      data-linha={l.id}
      className={cn(
        'group flex scroll-mt-24 items-start gap-1 py-0.5 pr-2 transition-colors duration-700 sm:pr-3 lg:scroll-mt-6',
        l.revisado_em && l.incidencia && 'bg-visto-fundo',
        destaque && 'bg-nevoa',
      )}
      style={{ paddingLeft: `${0.5 + l.nivel * 1.25}rem` }}
    >
      <span className="flex h-8 w-6 shrink-0 items-center justify-center">
        {temDentro ? (
          <button
            type="button"
            onClick={() => a().alternarRecolhida(l.id)}
            aria-expanded={!recolhida}
            aria-label={recolhida ? 'Mostrar as linhas de dentro' : 'Esconder as linhas de dentro'}
            className="grid size-6 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta"
          >
            <ChevronRight className={cn('size-4 transition-transform', !recolhida && 'rotate-90')} aria-hidden />
          </button>
        ) : (
          !recuo && <span className="size-1.5 rounded-full bg-lilas" aria-hidden />
        )}
      </span>

      <div className={cn('min-w-0 flex-1', recuo && '[&_[role=textbox]]:indent-5 sm:[&_[role=textbox]]:indent-8 sm:[&_[role=textbox]]:text-justify')}>
        {editando ? (
          <EditorDaLinha
            inicial={l.texto}
            ponto={ponto}
            aoRascunho={(html) => a().rascunho(l.id, html)}
            aoAcao={(html, acao) => a().acao(l.id, html, acao)}
            aoColarVarias={(partes) => a().colarVarias(l.id, partes)}
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label={`Editar a linha: ${textoPuro(l.texto).slice(0, 120) || 'em branco'}`}
            onClick={(e) => a().editar(l.id, { x: e.clientX, y: e.clientY })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                a().editar(l.id)
              }
            }}
            className={cn('min-h-8 cursor-text rounded-lg border border-transparent px-2 py-1 hover:bg-superficie-2/60 focus-visible:border-primaria focus-visible:outline-none', recuo && 'indent-5 sm:indent-8 sm:text-justify')}
          >
            <TextoDaLinha html={l.texto} />
            {recolhida && <span className="ml-2 text-sm whitespace-nowrap text-tinta-suave">({dentroRecolhidas} dentro)</span>}
          </div>
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center gap-0.5">
        {cartao && (
          <button
            type="button"
            onClick={() => a().abrirCartao(l)}
            title={`Flashcard desta linha · ${cartao}`}
            aria-label="Abrir o flashcard desta linha"
            className="grid size-7 place-items-center rounded-lg text-primaria-forte hover:bg-superficie-2 dark:text-primaria"
          >
            <Layers className="size-4" aria-hidden />
          </button>
        )}
        <MenuIncidencia valor={l.incidencia} aoMudar={(v) => a().mudarLinha(l.id, { incidencia: v, revisado_em: v ? l.revisado_em : null })} />
        {l.incidencia && (
          <input
            type="checkbox"
            className="visto mx-1 size-5 shrink-0"
            checked={!!l.revisado_em}
            onChange={() => a().mudarLinha(l.id, { revisado_em: l.revisado_em ? null : new Date().toISOString() })}
            aria-label={`${l.revisado_em ? 'Desmarcar' : 'Marcar'} como revisado: ${textoPuro(l.texto).slice(0, 80)}`}
            title={l.revisado_em ? `Revisado em ${format(new Date(l.revisado_em), 'dd/MM/yy')}` : 'Marcar como revisado'}
          />
        )}
        <MenuSobDemanda
          gatilho={
            <button type="button" aria-label="Ações da linha" className="grid size-7 place-items-center rounded-lg text-tinta-suave hover:bg-superficie-2 hover:text-tinta">
              <EllipsisVertical className="size-4" aria-hidden />
            </button>
          }
        >
            <Menu.Content align="end" sideOffset={4} className="z-50 min-w-60 rounded-xl border border-linha bg-superficie p-1.5 shadow-xl">
              <ItemMenu icone={<Layers className="size-4" />} onSelect={() => a().abrirCartao(l)}>
                {cartao ? 'Editar o flashcard' : 'Criar flashcard'}
              </ItemMenu>
              <ItemMenu icone={<CornerDownRight className="size-4" />} onSelect={() => a().novaDentro(l.id)}>
                Nova linha dentro
              </ItemMenu>
              <Menu.Separator className="my-1 h-px bg-linha/70" />
              <ItemMenu icone={<IndentIncrease className="size-4" />} atalho="Tab" onSelect={() => a().estrutura(l.id, 'recuar')}>
                Colocar dentro da de cima
              </ItemMenu>
              <ItemMenu icone={<IndentDecrease className="size-4" />} atalho="Shift+Tab" onSelect={() => a().estrutura(l.id, 'avancar')}>
                Tirar de dentro
              </ItemMenu>
              <ItemMenu icone={<ArrowUp className="size-4" />} atalho="Alt+↑" onSelect={() => a().estrutura(l.id, 'cima')}>
                Mover para cima
              </ItemMenu>
              <ItemMenu icone={<ArrowDown className="size-4" />} atalho="Alt+↓" onSelect={() => a().estrutura(l.id, 'baixo')}>
                Mover para baixo
              </ItemMenu>
              <Menu.Separator className="my-1 h-px bg-linha/70" />
              <ItemMenu icone={<Trash2 className="size-4" />} perigo onSelect={() => a().excluir(l)}>
                Excluir
              </ItemMenu>
            </Menu.Content>
        </MenuSobDemanda>
      </div>
    </li>
  )
})

/** "**trecho**" vira negrito (na importação por lista) */
const negritoDoTexto = (html: string) => html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')

/** O texto da linha fora da edição (limpo de novo ao exibir) */
const TextoDaLinha = memo(function TextoDaLinha({ html }: { html: string }) {
  const limpo = useMemo(() => linhaParaExibir(limparHtml(html)), [html])
  if (!limpo) return <span className="text-[15px] leading-relaxed text-tinta-suave/70">Linha em branco</span>
  return <span className="texto-rico inline text-[15px] leading-relaxed text-tinta [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: limpo }} />
})

function EditorDaLinha({
  inicial,
  ponto,
  aoRascunho,
  aoAcao,
  aoColarVarias,
}: {
  inicial: string
  ponto?: { x: number; y: number }
  aoRascunho: (html: string) => void
  aoAcao: (html: string, acao: Acao) => void
  aoColarVarias: (partes: string[]) => boolean
}) {
  const [html, setHtml] = useState(inicial)
  const atual = useRef(inicial)
  const campo = useRef<CampoRicoRef>(null)

  useEffect(() => {
    campo.current?.focar(ponto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // enquanto escreve, o texto vai sendo guardado (o flashcard da linha só é acertado ao sair dela)
  useEffect(() => {
    if (html === inicial) return
    const t = window.setTimeout(() => aoRascunho(html), 1200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])

  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return
    const agir = (acao: Acao) => {
      e.preventDefault()
      aoAcao(atual.current, acao)
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) return agir('enter')
    if (e.key === 'Tab') return agir(e.shiftKey ? 'avancar' : 'recuar')
    if (e.key === 'Escape') return agir('sair')
    if (e.altKey && e.key === 'ArrowUp') return agir('cima')
    if (e.altKey && e.key === 'ArrowDown') return agir('baixo')
    if (e.key === 'Backspace' && vazio(atual.current)) return agir('apagar')
  }

  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) aoAcao(atual.current, 'sair')
      }}
    >
      <CampoRico
        ref={campo}
        linha
        omissao
        rotulo="Texto da linha"
        valor={html}
        aoMudar={(v) => {
          atual.current = v
          setHtml(v)
        }}
        aoTecla={tecla}
        aoColarVarias={aoColarVarias}
        placeholder="Art. 11-A — assunto, pegadinha, súmula…"
      />
    </div>
  )
}

function MenuIncidencia({ valor, aoMudar }: { valor: Incidencia | null; aoMudar: (v: Incidencia | null) => void }) {
  return (
    <MenuSobDemanda
      gatilho={
        valor ? (
          <button
            type="button"
            aria-label={`Incidência ${ROTULO_INCIDENCIA[valor].toLowerCase()}. Mudar`}
            title="Incidência: o quanto este artigo é cobrado"
            className="inline-flex h-6 items-center gap-1.5 rounded-md border border-linha bg-superficie px-2 text-xs font-semibold text-tinta hover:border-lilas"
          >
            <span className="size-2 rounded-full" style={{ background: COR_INCIDENCIA[valor] }} aria-hidden />
            {ROTULO_INCIDENCIA[valor]}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Marcar a incidência"
            title="Marcar a incidência (o quanto este artigo é cobrado)"
            className="grid size-7 place-items-center rounded-lg text-tinta-suave/50 hover:bg-superficie-2 hover:text-tinta group-hover:text-tinta-suave"
          >
            <Flag className="size-4" aria-hidden />
          </button>
        )
      }
      largura="min-w-48"
    >
          <Menu.Label className="px-3 pt-1.5 pb-1 text-xs text-tinta-suave">Incidência nas provas</Menu.Label>
          {INCIDENCIAS.map((i) => (
            <ItemMenu key={i} icone={<span className="size-2.5 rounded-full" style={{ background: COR_INCIDENCIA[i] }} />} onSelect={() => aoMudar(i)}>
              {ROTULO_INCIDENCIA[i]}
            </ItemMenu>
          ))}
          {valor && (
            <ItemMenu icone={<span className="size-2.5 rounded-full border border-linha" />} onSelect={() => aoMudar(null)}>
              Sem incidência
            </ItemMenu>
          )}
    </MenuSobDemanda>
  )
}

/**
 * Menu que só é montado no primeiro clique: numa lei com milhares de linhas, montar dois menus por linha deixa a tela lenta.
 * Não é modal (não esconde o resto da página), o que também deixa abrir e fechar rápido.
 */
function MenuSobDemanda({ gatilho, children, largura = 'min-w-60' }: { gatilho: ReactElement<{ onClick?: () => void }>; children: ReactNode; largura?: string }) {
  const [montado, setMontado] = useState(false)
  if (!montado) return cloneElement(gatilho, { onClick: () => setMontado(true) })
  return (
    <Menu.Root defaultOpen modal={false}>
      <Menu.Trigger asChild>{gatilho}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className={cn('z-50 rounded-xl border border-linha bg-superficie p-1.5 shadow-xl', largura)}>
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

function ItemMenu({ icone, children, onSelect, perigo, atalho }: { icone: ReactNode; children: ReactNode; onSelect: () => void; perigo?: boolean; atalho?: string }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] outline-none select-none data-[highlighted]:bg-superficie-2', perigo ? 'text-ruim' : 'text-tinta')}
    >
      <span className={cn('grid w-4 place-items-center', perigo ? 'text-ruim' : 'text-tinta-suave')}>{icone}</span>
      {children}
      {atalho && <span className="ml-auto hidden pl-3 text-xs text-tinta-suave sm:inline">{atalho}</span>}
    </Menu.Item>
  )
}
