import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Botao, Dialogo } from '@/components/ui'
import { exportarParaAnki } from '@/lib/flashcards/exportarAnki'
import { mensagemErro } from '@/lib/utils'
import type { Disciplina, FlashCartao, FlashNota, Topico } from '@/types'

/** Exportar os flashcards para um pacote do Anki (.apkg), escolhendo os baralhos e se leva o progresso */
export function ExportarAnkiDialog({
  aberto,
  aoMudar,
  notas,
  cartoesPorNota,
  disciplinas,
  topicos,
}: {
  aberto: boolean
  aoMudar: (a: boolean) => void
  notas: FlashNota[]
  cartoesPorNota: Map<string, FlashCartao[]>
  disciplinas: Disciplina[]
  topicos: Topico[]
}) {
  const baralhos = useMemo(() => {
    const n = new Map<string, number>()
    for (const x of notas) n.set(x.disciplina_id, (n.get(x.disciplina_id) ?? 0) + 1)
    return disciplinas.filter((d) => n.has(d.id)).map((d) => ({ d, notas: n.get(d.id) ?? 0 }))
  }, [notas, disciplinas])

  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set())
  const [comProgresso, setComProgresso] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [passo, setPasso] = useState('')
  useEffect(() => {
    if (aberto) setEscolhidos(new Set(baralhos.map((b) => b.d.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const total = baralhos.filter((b) => escolhidos.has(b.d.id)).reduce((s, b) => s + b.notas, 0)
  const todos = escolhidos.size === baralhos.length

  const gerar = async () => {
    setGerando(true)
    setPasso('Preparando…')
    try {
      const r = await exportarParaAnki({
        notas: notas.filter((n) => escolhidos.has(n.disciplina_id)),
        cartoesPorNota,
        disciplinas,
        topicos,
        comProgresso,
        aoProgredir: setPasso,
        baixarImagem: async (url) => {
          const resp = await fetch(url)
          if (!resp.ok) return null
          return new Uint8Array(await resp.arrayBuffer())
        },
      })
      const blob = new Blob([r.arquivo as BlobPart], { type: 'application/octet-stream' })
      const link = document.createElement('a')
      const data = new Date().toISOString().slice(0, 10)
      link.href = URL.createObjectURL(blob)
      link.download = todos ? `Aprovi - flashcards ${data}.apkg` : `Aprovi - ${baralhos.filter((b) => escolhidos.has(b.d.id)).length} baralhos ${data}.apkg`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
      toast.success(
        `Pacote pronto: ${r.notas} ${r.notas === 1 ? 'nota' : 'notas'}, ${r.cartoes} ${r.cartoes === 1 ? 'cartão' : 'cartões'}` +
          (r.imagens ? `, ${r.imagens} ${r.imagens === 1 ? 'imagem' : 'imagens'}` : '') +
          '. Abra o arquivo no Anki para importar.',
      )
      if (r.imagensQueFalharam) toast.warning(`${r.imagensQueFalharam} ${r.imagensQueFalharam === 1 ? 'imagem não baixou' : 'imagens não baixaram'} e ficaram com o endereço da internet no cartão.`)
      aoMudar(false)
    } catch (e) {
      toast.error(`Não deu para gerar o pacote. ${mensagemErro(e)}`)
    } finally {
      setGerando(false)
      setPasso('')
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      aoMudar={(a) => !gerando && aoMudar(a)}
      titulo="Exportar para o Anki"
      descricao="Gera um arquivo .apkg com os cartões, as imagens e a formatação (grifos, cores, tamanhos). No Anki, é só abrir o arquivo ou usar Arquivo › Importar."
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-tinta">Baralhos</p>
        <button
          type="button"
          className="text-sm font-medium text-primaria-forte hover:underline dark:text-primaria"
          onClick={() => setEscolhidos(todos ? new Set() : new Set(baralhos.map((b) => b.d.id)))}
        >
          {todos ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-linha/70 p-2">
        {baralhos.map(({ d, notas: n }) => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-nevoa/40">
              <input
                type="checkbox"
                className="size-4"
                checked={escolhidos.has(d.id)}
                onChange={() =>
                  setEscolhidos((s) => {
                    const novo = new Set(s)
                    if (novo.has(d.id)) novo.delete(d.id)
                    else novo.add(d.id)
                    return novo
                  })
                }
              />
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.cor }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[15px] text-tinta">{d.nome}</span>
              <span className="text-sm text-tinta-suave numeros">{n}</span>
            </label>
          </li>
        ))}
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-4" checked={comProgresso} onChange={(e) => setComProgresso(e.target.checked)} />
        <span>
          <span className="block text-[15px] text-tinta">Levar o progresso das revisões</span>
          <span className="block text-sm text-tinta-suave">Cartões em revisão vão com o vencimento e o intervalo; os que ainda estão aprendendo vão como novos. Desmarcado, tudo vai como novo.</span>
        </span>
      </label>

      <div className="-mx-5 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-linha/70 px-5 pt-4 sm:-mx-6 sm:px-6">
        {gerando && (
          <span className="mr-auto text-sm text-tinta-suave" aria-live="polite">
            {passo}
          </span>
        )}
        <Botao variante="secundario" onClick={() => aoMudar(false)} disabled={gerando}>
          Cancelar
        </Botao>
        <Botao onClick={gerar} carregando={gerando} disabled={!total}>
          <Download className="size-4" aria-hidden /> Baixar {total} {total === 1 ? 'nota' : 'notas'}
        </Botao>
      </div>
    </Dialogo>
  )
}
