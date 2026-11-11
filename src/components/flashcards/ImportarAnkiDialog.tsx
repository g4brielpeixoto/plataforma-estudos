import { CircleCheck, FileUp, Image as ImageIcon, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { useImportarFlashcards, type NotaParaImportar, type PlanoImportacaoFlash, type ProgressoImportacao } from '@/hooks/dados'
import type { ColecaoImportada, NotaImportada } from '@/lib/flashcards/anki'
import { textoPuro } from '@/lib/flashcards/html'
import { rotuloSelecao } from '@/lib/topicos'
import { cn, CORES_DISCIPLINA, mensagemErro, normalizar } from '@/lib/utils'
import type { Disciplina, FlashCartao, FlashNota, Topico } from '@/types'
import { BarraProgresso, Botao, Dialogo, Selecao } from '../ui'

type Etapa = 'arquivo' | 'lendo' | 'mapear' | 'gravando' | 'pronto'

/** Destino de cada baralho do Anki: "d:<id>" (disciplina existente), "n:<nome>" (criar) ou "x" (não importar) */
interface Destino {
  disciplina: string
  topico: string
}

/** Sugere a disciplina (e o tópico) pelo nome do baralho: "Direito do Trabalho::Jornada" → disciplina + tópico */
export function sugerirDestino(baralho: string, disciplinas: Disciplina[], topicos: Topico[]): Destino {
  const partes = baralho.split('::').map((p) => p.trim()).filter(Boolean)
  // compara sem a numeração do edital ("6.1 Jornada de trabalho" = "Jornada de trabalho")
  const semNumero = (t: string) => normalizar(t).replace(/^[\d.]+\s*[-–.)]?\s*/, '')
  const norm = partes.map(semNumero)
  const acharDisciplina = (i: number) =>
    disciplinas.find((d) => semNumero(d.nome) === norm[i]) ??
    disciplinas.find((d) => {
      const n = semNumero(d.nome)
      return norm[i].length >= 5 && n.length >= 5 && (n.includes(norm[i]) || norm[i].includes(n))
    })
  for (let i = 0; i < partes.length; i++) {
    const d = acharDisciplina(i)
    if (!d) continue
    for (let j = partes.length - 1; j > i; j--) {
      const t = topicos.find((x) => x.disciplina_id === d.id && semNumero(x.nome) === norm[j])
      if (t) return { disciplina: `d:${d.id}`, topico: t.id }
    }
    return { disciplina: `d:${d.id}`, topico: '' }
  }
  return { disciplina: `n:${partes[0] ?? 'Importado do Anki'}`, topico: '' }
}

export function ImportarAnkiDialog({
  aberto,
  aoMudar,
  disciplinas,
  topicos,
  notasExistentes,
  cartoesExistentes,
}: {
  aberto: boolean
  aoMudar: (a: boolean) => void
  disciplinas: Disciplina[]
  topicos: Topico[]
  notasExistentes: FlashNota[]
  cartoesExistentes: FlashCartao[]
}) {
  const importar = useImportarFlashcards()
  const [etapa, setEtapa] = useState<Etapa>('arquivo')
  const [erro, setErro] = useState('')
  const [colecao, setColecao] = useState<ColecaoImportada | null>(null)
  const [destinos, setDestinos] = useState<Record<string, Destino>>({})
  const [manterProgresso, setManterProgresso] = useState(true)
  const [progresso, setProgresso] = useState<ProgressoImportacao>({ fase: 'notas', feitas: 0, total: 0 })
  const [resultado, setResultado] = useState<{ notas: number; cartoes: number; disciplinasNovas: number; imagens: number; imagensComFalha: number; completadas: number } | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const reiniciar = () => {
    setEtapa('arquivo')
    setErro('')
    setColecao(null)
    setDestinos({})
    setResultado(null)
    setManterProgresso(true)
  }

  const fechar = (a: boolean) => {
    if (etapa === 'gravando') return
    aoMudar(a)
    if (!a) setTimeout(reiniciar, 200)
  }

  // já importada antes: mesmo id do Anki; no .txt sem id, mesmo texto na frente
  const { jaExiste, aCompletar } = useMemo(() => {
    const porOrigem = new Map(notasExistentes.filter((n) => n.origem_anki).map((n) => [n.origem_anki as string, n]))
    const frentes = new Set(notasExistentes.map((n) => normalizar(textoPuro(n.frente))))
    return {
      jaExiste: (n: NotaImportada) => porOrigem.has(n.origem) || (n.origem.startsWith('txt:') && frentes.has(normalizar(textoPuro(n.frente)))),
      /** nota importada antes, quando as imagens ainda não vinham, que agora pode recebê-las */
      aCompletar: (n: NotaImportada) => {
        const e = porOrigem.get(n.origem)
        return e && n.midias.length > 0 && `${e.frente}${e.verso}`.includes('[imagem]') ? e : undefined
      },
    }
  }, [notasExistentes])

  const ler = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setErro('')
    setEtapa('lendo')
    try {
      const { lerArquivoAnki } = await import('@/lib/flashcards/anki')
      const c = await lerArquivoAnki(arquivo)
      if (!c.notas.length) throw new Error('Não encontrei cartões nesse arquivo. Confira se exportou o baralho certo.')
      setColecao(c)
      setDestinos(Object.fromEntries(c.baralhos.map((b) => [b.nome, sugerirDestino(b.nome, disciplinas, topicos)])))
      setEtapa('mapear')
    } catch (e) {
      setErro(mensagemErro(e))
      setEtapa('arquivo')
    }
  }

  // o que vai ser importado de cada baralho (pulando o que já veio antes)
  const resumo = useMemo(() => {
    const porBaralho = new Map<string, { novas: number; repetidas: number }>()
    if (!colecao) return { porBaralho, total: 0, cartoes: 0, completar: 0, imagens: 0 }
    let total = 0
    let cartoes = 0
    let completar = 0
    const imagens = new Set<string>()
    for (const n of colecao.notas) {
      const r = porBaralho.get(n.baralho) ?? { novas: 0, repetidas: 0 }
      const vai = destinos[n.baralho]?.disciplina !== 'x'
      if (jaExiste(n)) {
        r.repetidas++
        if (vai && aCompletar(n)) {
          completar++
          n.midias.forEach((m) => imagens.add(m))
        }
      } else {
        r.novas++
        if (vai) {
          total++
          cartoes += n.cartoes.length
          n.midias.forEach((m) => imagens.add(m))
        }
      }
      porBaralho.set(n.baralho, r)
    }
    return { porBaralho, total, cartoes, completar, imagens: imagens.size }
  }, [colecao, jaExiste, aCompletar, destinos])

  const gravar = async () => {
    if (!colecao) return
    // disciplinas novas (sem repetir nomes)
    const nomesNovos = [...new Set(Object.values(destinos).filter((d) => d.disciplina.startsWith('n:')).map((d) => d.disciplina.slice(2)))]
    const maiorOrdem = disciplinas.reduce((m, d) => Math.max(m, d.ordem), -1)
    const novasDisciplinas = nomesNovos.map((nome, i) => ({ nome: nome.slice(0, 120), cor: CORES_DISCIPLINA[(disciplinas.length + i) % CORES_DISCIPLINA.length], ordem: maiorOrdem + 1 + i }))

    // novos entram no fim da fila, na ordem que tinham no Anki
    let posicao = cartoesExistentes.reduce((m, c) => Math.max(m, c.posicao), 0) + 1
    const notas: NotaParaImportar[] = []
    const completar: PlanoImportacaoFlash['completar'] = []
    const midias = new Set<string>()
    const ordenadas = [...colecao.notas].sort((a, b) => Math.min(...a.cartoes.map((c) => c.posicao)) - Math.min(...b.cartoes.map((c) => c.posicao)))
    for (const n of ordenadas) {
      const destino = destinos[n.baralho]
      if (!destino || destino.disciplina === 'x') continue
      if (jaExiste(n)) {
        const existente = aCompletar(n)
        if (existente) {
          completar.push({ nota: existente, frente: n.frente, verso: n.verso })
          n.midias.forEach((m) => midias.add(m))
        }
        continue
      }
      n.midias.forEach((m) => midias.add(m))
      const existente = destino.disciplina.startsWith('d:') ? destino.disciplina.slice(2) : null
      notas.push({
        id: crypto.randomUUID(),
        origem: n.origem,
        disciplinaId: existente,
        novaDisciplina: existente ? null : destino.disciplina.slice(2).slice(0, 120),
        topicoId: existente && destino.topico ? destino.topico : null,
        tipo: n.tipo,
        frente: n.frente,
        verso: n.verso,
        cartoes: n.cartoes.map((c) => ({ ...c, agenda: manterProgresso ? c.agenda : null, posicao: posicao++ })),
      })
    }
    if (!notas.length && !completar.length) return setErro('Nada para importar: escolha um destino para pelo menos um baralho.')
    const plano: PlanoImportacaoFlash = {
      novasDisciplinas: novasDisciplinas.filter((d) => notas.some((n) => n.novaDisciplina === d.nome)),
      notas,
      completar,
      midias: [...midias],
      lerMidias: colecao.lerMidias,
    }
    setErro('')
    setProgresso({ fase: midias.size ? 'imagens' : 'notas', feitas: 0, total: midias.size || notas.length })
    setEtapa('gravando')
    try {
      const r = await importar.mutateAsync({ plano, aoProgredir: setProgresso })
      setResultado(r)
      setEtapa('pronto')
    } catch (e) {
      setErro(`A importação parou no meio: ${mensagemErro(e)}. O que já entrou foi salvo; importe o mesmo arquivo de novo para completar (o que já existe é pulado).`)
      setEtapa('mapear')
    }
  }

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    void ler(e.dataTransfer.files[0])
  }

  const avisos: string[] = []
  if (colecao?.invertidos) avisos.push(`${colecao.invertidos} ${colecao.invertidos === 1 ? 'cartão invertido (verso → frente) fica' : 'cartões invertidos (verso → frente) ficam'} de fora: aqui cada nota de frente e verso vira um cartão só.`)
  if (colecao?.imagensFaltando)
    avisos.push(
      colecao.formato === 'txt'
        ? `${colecao.imagensFaltando} ${colecao.imagensFaltando === 1 ? 'imagem não vem' : 'imagens não vêm'} no arquivo .txt; no lugar aparece "[imagem]". Para trazer as imagens, exporte como .apkg.`
        : `${colecao.imagensFaltando} ${colecao.imagensFaltando === 1 ? 'imagem não está' : 'imagens não estão'} no arquivo; no lugar aparece "[imagem]". No Anki, marque "Incluir mídia" ao exportar.`,
    )
  if (colecao?.vazias) avisos.push(`${colecao.vazias} ${colecao.vazias === 1 ? 'nota sem texto foi ignorada' : 'notas sem texto foram ignoradas'}.`)

  return (
    <Dialogo aberto={aberto} aoMudar={fechar} titulo="Importar do Anki" descricao={etapa === 'mapear' ? 'Escolha para qual disciplina vai cada baralho.' : undefined} largura="max-w-2xl">
      {(etapa === 'arquivo' || etapa === 'lendo') && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
            className={cn(
              'flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              arrastando ? 'border-primaria bg-nevoa/40' : 'border-linha bg-superficie-2/50',
            )}
          >
            {etapa === 'lendo' ? (
              <>
                <LoaderCircle className="size-8 animate-spin text-primaria" aria-hidden />
                <p className="mt-3 font-medium text-tinta" role="status">
                  Lendo o arquivo…
                </p>
              </>
            ) : (
              <>
                <FileUp className="size-8 text-lavanda" aria-hidden />
                <p className="mt-3 font-medium text-tinta">Arraste o arquivo aqui ou escolha no computador</p>
                <p className="mt-1 text-sm text-tinta-suave">.apkg, .colpkg ou .txt exportado pelo Anki</p>
                <Botao type="button" className="mt-4" onClick={() => entrada.current?.click()}>
                  Escolher arquivo
                </Botao>
                <input
                  ref={entrada}
                  type="file"
                  accept=".apkg,.colpkg,.txt,.tsv,.csv"
                  className="sr-only"
                  onChange={(e) => {
                    void ler(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </>
            )}
          </div>
          {erro && (
            <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
              {erro}
            </p>
          )}
          <div className="rounded-xl bg-superficie-2/70 px-4 py-3 text-sm text-tinta-suave">
            <p className="font-medium text-tinta">Como exportar no Anki</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              <li>No Anki do computador, abra Arquivo › Exportar.</li>
              <li>Em formato, escolha "Pacote de baralho do Anki (.apkg)" e o baralho (ou "Todos os baralhos").</li>
              <li>Marque "Incluir agendamento" para trazer o progresso. A mídia não é necessária.</li>
            </ol>
          </div>
        </div>
      )}

      {etapa === 'mapear' && colecao && (
        <div className="space-y-4">
          <ul className="divide-y divide-linha/70 rounded-2xl border border-linha/70">
            {colecao.baralhos.map((b) => {
              const destino = destinos[b.nome] ?? { disciplina: 'x', topico: '' }
              const disciplinaId = destino.disciplina.startsWith('d:') ? destino.disciplina.slice(2) : ''
              const r = resumo.porBaralho.get(b.nome)
              const nomeNovo = b.nome.split('::')[0].trim()
              return (
                <li key={b.nome} className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:p-4">
                  <div className="min-w-0">
                    <p className="font-medium [overflow-wrap:anywhere] text-tinta">{b.nome.split('::').join(' › ')}</p>
                    <p className="text-sm text-tinta-suave numeros">
                      {b.notas} {b.notas === 1 ? 'nota' : 'notas'} · {b.cartoes} {b.cartoes === 1 ? 'cartão' : 'cartões'}
                      {r?.repetidas ? ` · ${r.repetidas} já importada${r.repetidas === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Selecao
                      aria-label={`Disciplina para ${b.nome}`}
                      value={destino.disciplina}
                      onChange={(e) => setDestinos((d) => ({ ...d, [b.nome]: { disciplina: e.target.value, topico: '' } }))}
                      className="text-sm"
                    >
                      {disciplinas.map((d) => (
                        <option key={d.id} value={`d:${d.id}`}>
                          {d.nome}
                        </option>
                      ))}
                      <option value={`n:${nomeNovo}`}>Criar disciplina "{nomeNovo}"</option>
                      {destino.disciplina.startsWith('n:') && destino.disciplina !== `n:${nomeNovo}` && (
                        <option value={destino.disciplina}>Criar disciplina "{destino.disciplina.slice(2)}"</option>
                      )}
                      <option value="x">Não importar</option>
                    </Selecao>
                    {disciplinaId && (
                      <Selecao
                        aria-label={`Tópico para ${b.nome}`}
                        value={destino.topico}
                        onChange={(e) => setDestinos((d) => ({ ...d, [b.nome]: { ...destino, topico: e.target.value } }))}
                        className="text-sm"
                      >
                        <option value="">Sem tópico</option>
                        {topicos
                          .filter((t) => t.disciplina_id === disciplinaId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {rotuloSelecao(t, topicos)}
                            </option>
                          ))}
                      </Selecao>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {colecao.comProgresso && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-superficie-2 px-3 py-3 text-[15px] text-tinta">
              <input type="checkbox" className="mt-0.5" checked={manterProgresso} onChange={(e) => setManterProgresso(e.target.checked)} />
              <span>
                Manter o progresso do Anki
                <span className="block text-sm text-tinta-suave">Cartões que você já revisa continuam com as mesmas datas. Desmarque para começar todos como novos.</span>
              </span>
            </label>
          )}

          {(resumo.imagens > 0 || resumo.completar > 0) && (
            <p className="flex gap-2 rounded-xl bg-superficie-2 px-4 py-3 text-sm text-tinta">
              <ImageIcon className="mt-0.5 size-4 shrink-0 text-tinta-suave" aria-hidden />
              <span>
                {resumo.imagens > 0 && `${resumo.imagens.toLocaleString('pt-BR')} ${resumo.imagens === 1 ? 'imagem vai' : 'imagens vão'} junto (as grandes são reduzidas para no máximo 1600 px).`}
                {resumo.completar > 0 &&
                  ` ${resumo.completar.toLocaleString('pt-BR')} ${resumo.completar === 1 ? 'nota importada antes sem imagem vai recebê-la' : 'notas importadas antes sem imagem vão recebê-las'} agora.`}
              </span>
            </p>
          )}

          {avisos.length > 0 && (
            <ul className="space-y-1.5 rounded-xl bg-medio-fundo px-4 py-3 text-sm text-tinta">
              {avisos.map((a) => (
                <li key={a} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-medio" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          )}

          {erro && (
            <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
              {erro}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Botao type="button" variante="fantasma" onClick={reiniciar}>
              Outro arquivo
            </Botao>
            <Botao type="button" onClick={() => void gravar()} disabled={!resumo.total && !resumo.completar}>
              {resumo.total
                ? `Importar ${resumo.total.toLocaleString('pt-BR')} ${resumo.total === 1 ? 'nota' : 'notas'} (${resumo.cartoes.toLocaleString('pt-BR')} ${resumo.cartoes === 1 ? 'cartão' : 'cartões'})`
                : resumo.completar
                  ? `Completar ${resumo.completar.toLocaleString('pt-BR')} ${resumo.completar === 1 ? 'nota' : 'notas'} com as imagens`
                  : 'Tudo já foi importado'}
            </Botao>
          </div>
        </div>
      )}

      {etapa === 'gravando' && (
        <div className="space-y-3 py-6" role="status">
          <p className="font-medium text-tinta">{progresso.fase === 'imagens' ? 'Enviando as imagens…' : 'Importando as notas…'}</p>
          <BarraProgresso valor={progresso.total ? (progresso.feitas / progresso.total) * 100 : 0} rotulo="Progresso da importação" />
          <p className="text-sm text-tinta-suave numeros">
            {progresso.feitas.toLocaleString('pt-BR')} de {progresso.total.toLocaleString('pt-BR')} {progresso.fase === 'imagens' ? 'imagens' : 'notas'}. Não feche esta janela.
          </p>
        </div>
      )}

      {etapa === 'pronto' && resultado && (
        <div className="space-y-5 py-2 text-center">
          <CircleCheck className="mx-auto size-10 text-bom" aria-hidden />
          <div>
            <p className="text-xl text-tinta">Importação concluída</p>
            <p className="mt-1 text-tinta-suave numeros">
              {resultado.notas > 0 && (
                <>
                  {resultado.notas.toLocaleString('pt-BR')} {resultado.notas === 1 ? 'nota' : 'notas'} e {resultado.cartoes.toLocaleString('pt-BR')}{' '}
                  {resultado.cartoes === 1 ? 'cartão' : 'cartões'}
                  {resultado.disciplinasNovas ? `, ${resultado.disciplinasNovas} ${resultado.disciplinasNovas === 1 ? 'disciplina nova' : 'disciplinas novas'}` : ''}
                  {resultado.imagens ? `, ${resultado.imagens} ${resultado.imagens === 1 ? 'imagem' : 'imagens'}` : ''}.{' '}
                </>
              )}
              {resultado.completadas > 0 && `${resultado.completadas} ${resultado.completadas === 1 ? 'nota importada antes recebeu' : 'notas importadas antes receberam'} as imagens.`}
            </p>
            {resultado.imagensComFalha > 0 && (
              <p className="mt-2 text-sm text-medio">
                {resultado.imagensComFalha} {resultado.imagensComFalha === 1 ? 'imagem não pôde ser enviada' : 'imagens não puderam ser enviadas'} (formato que o navegador não abre ou maior que 5 MB) e
                {resultado.imagensComFalha === 1 ? ' aparece' : ' aparecem'} como "[imagem]".
              </p>
            )}
          </div>
          <Botao onClick={() => fechar(false)}>Ver baralhos</Botao>
        </div>
      )}
    </Dialogo>
  )
}
