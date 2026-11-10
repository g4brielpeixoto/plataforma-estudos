import { CircleCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useDisciplinas, useFlashCartoes, useSalvarNotaFlash, useTopicos } from '@/hooks/dados'
import { limparHtml, vazio } from '@/lib/flashcards/html'
import { numerosOmissao } from '@/lib/flashcards/omissao'
import { rotuloSelecao } from '@/lib/topicos'
import { cn, mensagemErro } from '@/lib/utils'
import type { FlashNota, TipoNotaFlash } from '@/types'
import { Botao, Campo, Dialogo, Interruptor, Selecao } from '../ui'
import { CampoRico, type CampoRicoRef } from './CampoRico'

const CHAVE_CRIAR_NOVO = 'flash:criar-novo'

function lerCriarNovo() {
  try {
    return localStorage.getItem(CHAVE_CRIAR_NOVO) === '1'
  } catch {
    return false
  }
}

/** Criar ou editar um flashcard (frente e verso, ou omissão de palavras) */
export function NotaFlashDialog({
  aberto,
  aoMudar,
  nota,
  disciplinaInicial,
  topicoInicial,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  nota?: FlashNota | null
  disciplinaInicial?: string
  topicoInicial?: string | null
}) {
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const cartoes = useFlashCartoes()
  const salvar = useSalvarNotaFlash()

  const [tipo, setTipo] = useState<TipoNotaFlash>('basico')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [topicoId, setTopicoId] = useState('')
  const [frente, setFrente] = useState('')
  const [verso, setVerso] = useState('')
  const [erro, setErro] = useState('')
  const [criarNovo, setCriarNovo] = useState(lerCriarNovo)
  const [salvos, setSalvos] = useState(0)
  const [enviandoFrente, setEnviandoFrente] = useState(0)
  const [enviandoVerso, setEnviandoVerso] = useState(0)
  const enviando = enviandoFrente + enviandoVerso > 0
  const refFrente = useRef<CampoRicoRef>(null)

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setSalvos(0)
    setTipo(nota?.tipo ?? 'basico')
    setDisciplinaId(nota?.disciplina_id ?? disciplinaInicial ?? '')
    setTopicoId(nota?.topico_id ?? topicoInicial ?? '')
    setFrente(nota?.frente ?? '')
    setVerso(nota?.verso ?? '')
  }, [aberto, nota, disciplinaInicial, topicoInicial])

  const topicosDaDisciplina = useMemo(() => (topicos.data ?? []).filter((t) => t.disciplina_id === disciplinaId), [topicos.data, disciplinaId])
  const omissao = tipo === 'omissao'
  const numeros = omissao ? numerosOmissao(frente) : []

  const alternarCriarNovo = (v: boolean) => {
    setCriarNovo(v)
    try {
      localStorage.setItem(CHAVE_CRIAR_NOVO, v ? '1' : '0')
    } catch {
      /* sem armazenamento: só não fica salvo */
    }
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    const f = limparHtml(frente)
    const v = limparHtml(verso)
    if (!disciplinaId) return setErro('Escolha o baralho (disciplina).')
    if (vazio(f)) return setErro(omissao ? 'Escreva o texto do cartão.' : 'Escreva a pergunta na frente.')
    const ordens = omissao ? numerosOmissao(f) : [0]
    if (omissao && !ordens.length) return setErro('Marque ao menos um trecho para esconder: selecione e clique em Omissão (ou Ctrl+Shift+C).')
    if (!omissao && vazio(v)) return setErro('Escreva a resposta no verso.')
    if (f.length > 20000 || v.length > 20000) return setErro('O cartão ficou grande demais (limite de 20 mil caracteres por lado).')
    const posicao = (cartoes.data ?? []).reduce((m, c) => Math.max(m, c.posicao), 0) + 1
    try {
      await salvar.mutateAsync({ id: nota?.id, dados: { disciplina_id: disciplinaId, topico_id: topicoId || null, tipo, frente: f, verso: v }, ordens, posicao })
      if (nota || !criarNovo) {
        toast.success(nota ? 'Cartão atualizado.' : 'Cartão criado.')
        return aoMudar(false)
      }
      toast.success('Cartão criado.')
      setSalvos((n) => n + 1)
      setFrente('')
      setVerso('')
      requestAnimationFrame(() => refFrente.current?.focar())
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  const semDisciplinas = !disciplinas.isLoading && (disciplinas.data ?? []).length === 0

  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      titulo={nota ? 'Editar cartão' : 'Novo cartão'}
      descricao={omissao ? 'Escreva o texto e marque os trechos que devem ficar escondidos. Cada número de omissão vira um cartão.' : 'Pergunta na frente, resposta no verso.'}
      largura="max-w-2xl"
    >
      {semDisciplinas ? (
        <div className="rounded-2xl bg-superficie-2 p-5 text-center">
          <p className="font-medium text-tinta">Você ainda não tem disciplinas.</p>
          <p className="mt-1 text-sm text-tinta-suave">Os baralhos são as disciplinas do edital. Cadastre o edital primeiro.</p>
          <Link to="/edital" onClick={() => aoMudar(false)} className="mt-4 inline-flex h-10 items-center rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria">
            Ir para o edital
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          {salvos > 0 && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-bom-fundo px-3 py-2.5 text-sm text-tinta">
              <CircleCheck className="size-4 shrink-0 text-bom" aria-hidden />
              <span>
                <strong className="font-semibold">{salvos === 1 ? 'Cartão criado.' : `${salvos} cartões criados.`}</strong> Escreva o próximo.
              </span>
            </p>
          )}

          <div role="radiogroup" aria-label="Tipo de cartão" className="inline-flex rounded-xl bg-superficie-2 p-1">
            {(
              [
                ['basico', 'Frente e verso'],
                ['omissao', 'Omissão de palavras'],
              ] as [TipoNotaFlash, string][]
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={tipo === v}
                disabled={!!nota && tipo !== v}
                onClick={() => setTipo(v)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40',
                  tipo === v ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-suave hover:text-tinta',
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo rotulo="Baralho (disciplina)" htmlFor="f-disciplina">
              <Selecao
                id="f-disciplina"
                value={disciplinaId}
                onChange={(e) => {
                  setDisciplinaId(e.target.value)
                  setTopicoId('')
                }}
              >
                <option value="">Escolha…</option>
                {(disciplinas.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Tópico (opcional)" htmlFor="f-topico">
              <Selecao id="f-topico" value={topicoId} onChange={(e) => setTopicoId(e.target.value)} disabled={!disciplinaId}>
                <option value="">Sem tópico</option>
                {topicosDaDisciplina.map((t) => (
                  <option key={t.id} value={t.id}>
                    {rotuloSelecao(t)}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="f-frente" className="block text-sm font-medium text-tinta">
              {omissao ? 'Texto' : 'Frente'}
            </label>
            <CampoRico
              ref={refFrente}
              id="f-frente"
              rotulo={omissao ? 'Texto' : 'Frente'}
              valor={frente}
              aoMudar={setFrente}
              omissao={omissao}
              aoEnviar={setEnviandoFrente}
              placeholder={omissao ? 'Ex.: O prazo do mandado de segurança é de 120 dias.' : 'Pergunta'}
            />
            {omissao && (
              <p className="text-sm text-tinta-suave numeros">
                {numeros.length
                  ? `${numeros.length} ${numeros.length === 1 ? 'cartão' : 'cartões'}: ${numeros.map((n) => `c${n}`).join(', ')}. Para esconder dois trechos no mesmo cartão, use o mesmo número.`
                  : 'Selecione um trecho e clique em Omissão. Ele vira {{c1::trecho}}.'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="f-verso" className="block text-sm font-medium text-tinta">
              {omissao ? 'Extra (opcional)' : 'Verso'}
            </label>
            <CampoRico
              id="f-verso"
              rotulo={omissao ? 'Extra' : 'Verso'}
              valor={verso}
              aoMudar={setVerso}
              aoEnviar={setEnviandoVerso}
              placeholder={omissao ? 'Mostrado junto com a resposta (fonte, artigo, comentário)' : 'Resposta'}
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
              {erro}
            </p>
          )}

          <div className="-mx-5 border-t border-linha/70 px-5 pt-4 sm:-mx-6 sm:px-6">
            {!nota && (
              <Interruptor ligado={criarNovo} aoMudar={alternarCriarNovo} rotulo="Salvar e criar novo" descricao="Salva este cartão e abre outro em branco, no mesmo baralho e tópico." />
            )}
            <div className={cn('flex justify-end gap-2', !nota && 'mt-4')}>
              <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
                {salvos > 0 ? 'Fechar' : 'Cancelar'}
              </Botao>
              <Botao type="submit" carregando={salvar.isPending} disabled={enviando}>
                {enviando ? 'Enviando imagem…' : nota ? 'Salvar alterações' : 'Salvar cartão'}
              </Botao>
            </div>
          </div>
        </form>
      )}
    </Dialogo>
  )
}
