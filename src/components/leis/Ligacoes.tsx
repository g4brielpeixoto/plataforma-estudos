import { Search } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLeiLinhas, useLeis } from '@/hooks/dados'
import { limparHtml } from '@/lib/flashcards/html'
import { buscarDispositivos, caminhoDoDispositivo, descendentes, indiceDeBusca, linhaParaExibir, refsDoTexto, type ItemBusca } from '@/lib/leis'
import { cn } from '@/lib/utils'
import type { LeiLinha } from '@/types'
import { Dialogo } from '../ui'

export interface DestinoLigacao {
  id: string
  leiId: string
  leiNome: string
  /** "Art. 482, § 2º" */
  caminho: string
}

/**
 * Tudo o que as ligações precisam, de todas as leis: onde está cada linha, o índice de busca e quem cita quem.
 * `linhasAtuais` (as da lei aberta, editadas na tela) valem por cima das que estão no cache.
 */
export function useLigacoes(leiAtual: string | undefined, linhasAtuais: LeiLinha[] | null) {
  const leis = useLeis()
  const todas = useLeiLinhas()
  return useMemo(() => {
    const porLei = new Map<string, LeiLinha[]>()
    for (const l of todas.data ?? []) {
      if (l.lei_id === leiAtual && linhasAtuais) continue
      const lista = porLei.get(l.lei_id)
      if (lista) lista.push(l)
      else porLei.set(l.lei_id, [l])
    }
    if (leiAtual && linhasAtuais) porLei.set(leiAtual, linhasAtuais)
    const listaLeis = leis.data ?? []
    const nomeDa = new Map(listaLeis.map((l) => [l.id, l.nome]))
    const linhaPorId = new Map<string, LeiLinha>()
    const citadoEm = new Map<string, string[]>()
    for (const [, lista] of porLei)
      for (const l of lista) {
        linhaPorId.set(l.id, l)
        for (const alvo of refsDoTexto(l.texto)) {
          const quem = citadoEm.get(alvo)
          if (quem) {
            if (!quem.includes(l.id)) quem.push(l.id)
          } else citadoEm.set(alvo, [l.id])
        }
      }
    const cacheCaminho = new Map<string, string>()
    const destino = (id: string): DestinoLigacao | null => {
      const l = linhaPorId.get(id)
      if (!l) return null
      let caminho = cacheCaminho.get(id)
      if (caminho === undefined) {
        caminho = caminhoDoDispositivo(porLei.get(l.lei_id) ?? [], id)
        cacheCaminho.set(id, caminho)
      }
      return { id, leiId: l.lei_id, leiNome: nomeDa.get(l.lei_id) ?? 'Lei', caminho }
    }
    let indice: ItemBusca[] | null = null
    const buscar = (consulta: string) => {
      indice ??= indiceDeBusca(listaLeis, porLei)
      return buscarDispositivos(indice, consulta)
    }
    /** a linha e as de dentro dela (para a prévia) */
    const trecho = (id: string, maximo = 8) => {
      const l = linhaPorId.get(id)
      if (!l) return []
      const lista = porLei.get(l.lei_id) ?? []
      return [l, ...descendentes(lista, id)].slice(0, maximo)
    }
    return { destino, buscar, trecho, citadoEm, linhaPorId }
  }, [leis.data, todas.data, leiAtual, linhasAtuais])
}
export type Ligacoes = ReturnType<typeof useLigacoes>

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** HTML da etiqueta de uma ligação, para inserir no texto */
export const htmlDaLigacao = (d: DestinoLigacao) => `<span data-ref="${d.id}" class="ref-lei" contenteditable="false">${escapar(`${d.leiNome} › ${d.caminho}`)}</span>&nbsp;`

/** Ao exibir: as etiquetas mostram o nome atual do dispositivo; ligação para algo apagado fica riscada */
export function rotularLigacoes(html: string, destino: (id: string) => DestinoLigacao | null) {
  return html.replace(/<span data-ref="([0-9a-f-]{36})" class="ref-lei">([\s\S]*?)<\/span>/gi, (_t, id: string, texto: string) => {
    const d = destino(id.toLowerCase())
    return d
      ? `<span data-ref="${id}" class="ref-lei" role="link" tabindex="0">${escapar(`${d.leiNome} › ${d.caminho}`)}</span>`
      : `<span data-ref="${id}" class="ref-lei ref-quebrada" title="O dispositivo ligado foi apagado">${texto}</span>`
  })
}

/** Janela de busca de dispositivo: digita parte do nome da lei, o número do artigo ou um trecho do texto */
export function BuscaDispositivo({ aberto, aoFechar, aoEscolher, buscar }: { aberto: boolean; aoFechar: () => void; aoEscolher: (item: ItemBusca) => void; buscar: (q: string) => ItemBusca[] }) {
  const [consulta, setConsulta] = useState('')
  const [ativo, setAtivo] = useState(0)
  const campo = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (aberto) {
      setConsulta('')
      setAtivo(0)
    }
  }, [aberto])
  const achados = useMemo(() => (consulta.trim() ? buscar(consulta) : []), [consulta, buscar])
  useEffect(() => setAtivo(0), [consulta])
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAtivo((a) => Math.min(a + 1, achados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && achados[ativo]) {
      e.preventDefault()
      aoEscolher(achados[ativo])
    }
  }

  return (
    <Dialogo aberto={aberto} aoMudar={(v) => !v && aoFechar()} titulo="Ligar a um dispositivo" descricao="Procure pela lei, pelo número ou por um trecho: “clt 482”, “cf 7 xiii”, “prescrição intercorrente”." focoInicial={campo} sobreposto noTopo largura="max-w-2xl">
      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-xl border border-linha bg-superficie px-3 focus-within:border-primaria focus-within:ring-2 focus-within:ring-primaria/40">
          <Search className="size-4 shrink-0 text-tinta-suave" aria-hidden />
          <input
            ref={campo}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={tecla}
            placeholder="Ex.: clt 482"
            aria-label="Procurar dispositivo"
            role="combobox"
            aria-expanded={achados.length > 0}
            aria-controls="busca-dispositivo"
            aria-activedescendant={achados[ativo] ? `disp-${achados[ativo].id}` : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-tinta outline-none placeholder:text-tinta-suave/70 focus-visible:outline-none"
            style={{ outline: 'none', boxShadow: 'none' }}
          />
        </label>
        {consulta.trim() && !achados.length && <p className="px-1 text-sm text-tinta-suave">Nada encontrado. Tente só o número do artigo ou outra palavra do texto.</p>}
        <ul ref={lista} id="busca-dispositivo" role="listbox" className="max-h-[55dvh] space-y-0.5 overflow-y-auto">
          {achados.map((a, i) => (
            <li key={a.id} id={`disp-${a.id}`} data-i={i} role="option" aria-selected={i === ativo}>
              <button
                type="button"
                onMouseEnter={() => setAtivo(i)}
                onClick={() => aoEscolher(a)}
                className={cn('w-full rounded-lg px-3 py-2 text-left', i === ativo ? 'bg-nevoa/70' : 'hover:bg-superficie-2')}
              >
                <span className="block text-sm font-medium text-tinta">{a.rotulo}</span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-tinta-suave">{a.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialogo>
  )
}

const LARGURA = 420

/** Prévia do dispositivo ligado, junto da etiqueta (mouse em cima, ou primeiro toque no celular) */
export function PreviaLigacao({
  alvo,
  ligacoes,
  aoSair,
  aoAbrir,
  aoEntrarMouse,
  aoSairMouse,
}: {
  alvo: { id: string; el: HTMLElement } | null
  ligacoes: Ligacoes
  aoSair: () => void
  aoAbrir: (id: string) => void
  aoEntrarMouse?: () => void
  aoSairMouse?: () => void
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; largura: number } | null>(null)
  useLayoutEffect(() => {
    if (!alvo) return setPos(null)
    const r = alvo.el.getBoundingClientRect()
    const largura = Math.min(LARGURA, window.innerWidth - 16)
    const altura = caixa.current?.offsetHeight ?? 0
    const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))
    const top = r.bottom + 6 + altura < window.innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - altura - 6)
    setPos({ left, top, largura })
  }, [alvo])
  useEffect(() => {
    if (!alvo) return
    const fechar = () => aoSair()
    const fora = (e: PointerEvent) => {
      if (caixa.current?.contains(e.target as Node) || alvo.el.contains(e.target as Node)) return
      fechar()
    }
    const tecla = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && fechar()
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', fechar, true)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', fechar, true)
    }
  }, [alvo, aoSair])
  if (!alvo) return null
  const d = ligacoes.destino(alvo.id)
  const trecho = d ? ligacoes.trecho(alvo.id) : []
  const nivel0 = trecho[0]?.nivel ?? 0
  return createPortal(
    <div
      ref={caixa}
      role="tooltip"
      onMouseEnter={aoEntrarMouse}
      onMouseLeave={aoSairMouse}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.largura ?? LARGURA, visibility: pos ? 'visible' : 'hidden' }}
      className="fixed z-[70] rounded-xl border border-linha bg-superficie p-3 text-left shadow-xl"
    >
      {d ? (
        <>
          <p className="text-xs font-medium text-tinta-suave">
            {d.leiNome} › {d.caminho}
          </p>
          <div className="mt-1.5 max-h-72 space-y-1 overflow-y-auto">
            {trecho.map((l) => (
              <p
                key={l.id}
                className="texto-rico text-sm leading-relaxed text-tinta"
                style={{ paddingLeft: `${(l.nivel - nivel0) * 0.9}rem` }}
                dangerouslySetInnerHTML={{ __html: linhaParaExibir(limparHtml(l.texto)) }}
              />
            ))}
          </div>
          <button type="button" onClick={() => aoAbrir(alvo.id)} className="mt-2 text-sm font-medium text-primaria-forte hover:underline dark:text-primaria">
            Abrir na lei
          </button>
        </>
      ) : (
        <p className="text-sm text-tinta-suave">O dispositivo ligado foi apagado da lei.</p>
      )}
    </div>,
    document.body,
  )
}
