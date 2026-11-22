import { ChevronLeft, ChevronRight, ClipboardCheck, Link2, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { EstudoDialog } from '@/components/EstudoDialog'
import { ChipsMateriais, MateriaisDialog } from '@/components/Materiais'
import { AreaTexto, BarraProgresso, Botao, Dialogo, SeloAcerto } from '@/components/ui'
import { useEstudos, useMateriais, useSalvarMeta, useSalvarTopico } from '@/hooks/dados'
import type { CicloDados } from '@/hooks/useCicloDados'
import { metasPorDisciplina, questoesDaMeta, siglaDe, topicoParaComecar } from '@/lib/ciclos'
import { resumirPorTopico } from '@/lib/indicadores'
import { porTopico } from '@/lib/materiais'
import { numeracaoDeTodos } from '@/lib/topicos'
import { cn, formatarDuracao, mensagemErro, porcentagem } from '@/lib/utils'
import type { Topico } from '@/types'

const LIMITE_ORIENTACOES = 4000

/**
  Detalhe de uma meta: os assuntos (tópicos) com o check de concluído, os links de material,
  as questões feitas em cada um (todas as já registradas contam) e as orientações da meta.
*/
export function MetaDialog({ dados, metaId, aoMudarMeta }: { dados: CicloDados; metaId: string | null; aoMudarMeta: (id: string | null) => void }) {
  const navegar = useNavigate()
  const estudos = useEstudos()
  const materiais = useMateriais()
  const salvarTopico = useSalvarTopico()
  const salvarMeta = useSalvarMeta()

  // o detalhe sai da frente enquanto outro diálogo (registrar questões, materiais) está aberto
  const [registrando, setRegistrando] = useState<Topico | null>(null)
  const [materiaisDe, setMateriaisDe] = useState<Topico | null>(null)

  const s = metaId ? dados.situacao.get(metaId) : undefined
  const d = s ? dados.disciplinaPorId.get(s.meta.disciplina_id) : undefined
  const irmas = useMemo(() => (s ? (metasPorDisciplina(dados.metas).get(s.meta.disciplina_id) ?? []) : []), [s, dados.metas])
  const numeros = useMemo(() => numeracaoDeTodos(dados.topicos), [dados.topicos])
  const resumo = useMemo(() => resumirPorTopico(estudos.data ?? []), [estudos.data])
  const materiaisPorTopico = useMemo(() => porTopico(materiais.data ?? []), [materiais.data])
  const total = s ? questoesDaMeta(s, estudos.data ?? []) : null

  const [orientacoes, setOrientacoes] = useState('')
  useEffect(() => setOrientacoes(s?.meta.orientacoes ?? ''), [s?.meta.id, s?.meta.orientacoes])
  const gravarOrientacoes = () => {
    if (!s || orientacoes === s.meta.orientacoes) return
    salvarMeta.mutate({ id: s.meta.id, orientacoes }, { onError: (e) => toast.error(`As orientações não foram salvas. ${mensagemErro(e)}`) })
  }

  if (!s || !d) return null

  const indice = irmas.findIndex((m) => m.id === s.meta.id)
  const anterior = indice > 0 ? irmas[indice - 1] : undefined
  const proxima = indice >= 0 && indice < irmas.length - 1 ? irmas[indice + 1] : undefined
  const daVez = dados.metaDaVez?.meta.id === s.meta.id
  const pctTotal = total ? porcentagem(total.acertadas, total.feitas) : null

  const alternar = (t: Topico) =>
    salvarTopico.mutate({ id: t.id, concluido: !t.concluido }, { onError: (e) => toast.error(`Não deu para marcar o assunto. ${mensagemErro(e)}`) })

  const comecar = (t?: Topico) => {
    const alvo = t ?? topicoParaComecar(s)
    aoMudarMeta(null)
    navegar('/estudar', { state: { comecar: { disciplinaId: d.id, topicoId: alvo?.id } } })
  }

  return (
    <>
      <Dialogo
        aberto={!registrando && !materiaisDe}
        aoMudar={(a) => {
          if (!a) {
            gravarOrientacoes()
            aoMudarMeta(null)
          }
        }}
        titulo={`${siglaDe(d)} · Meta ${s.numero}`}
        descricao={s.meta.nome}
        largura="max-w-2xl"
      >
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tinta-suave">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: d.cor }} aria-hidden />
            {d.nome}
          </span>
          {daVez && <span className="rounded-md bg-nevoa px-1.5 py-0.5 text-xs font-medium text-tinta">Meta da vez</span>}
          {s.cumprida && <span className="rounded-md bg-visto-fundo px-1.5 py-0.5 text-xs font-medium text-visto-texto">Cumprida</span>}
        </div>

        <div className="flex items-center gap-3">
          <BarraProgresso valor={porcentagem(s.concluidos, s.topicos.length)} cor="var(--c-visto)" rotulo="Assuntos concluídos" />
          <span className="shrink-0 text-sm text-tinta-suave numeros">
            {s.concluidos} de {s.topicos.length}
          </span>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-tinta">Assuntos</h3>
        <ul className="mt-2 divide-y divide-linha/70 rounded-2xl border border-linha/70">
          {s.topicos.map((t) => {
            const r = resumo.get(t.id)
            const mats = materiaisPorTopico.get(t.id) ?? []
            return (
              <li key={t.id} className={cn('px-3 py-3 sm:px-4', t.concluido && 'bg-visto-fundo', t.nivel > 0 && 'pl-8 sm:pl-10', t.nivel > 1 && 'pl-12 sm:pl-14')}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="visto mt-0.5 size-5 shrink-0"
                    checked={t.concluido}
                    onChange={() => alternar(t)}
                    aria-label={`${t.concluido ? 'Desmarcar' : 'Marcar'} "${t.nome}" como concluído`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-snug text-tinta">
                      {numeros.get(t.id) && <span className="mr-1.5 text-tinta-suave numeros">{numeros.get(t.id)}</span>}
                      {t.nome}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-tinta-suave">
                      {r && r.questoesFeitas > 0 ? (
                        <span className="inline-flex items-center gap-1.5 numeros">
                          {r.questoesAcertadas}/{r.questoesFeitas} questões <SeloAcerto pct={r.acertoPct} className="text-xs" />
                        </span>
                      ) : (
                        <span>Sem questões</span>
                      )}
                      {r && r.tempoSegundos > 0 && <span className="numeros">{formatarDuracao(r.tempoSegundos)}</span>}
                      <ChipsMateriais materiais={mats} aoVerTodos={() => setMateriaisDe(t)} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Botao tamanho="sm" variante="secundario" onClick={() => setRegistrando(t)}>
                        <ClipboardCheck className="size-3.5" aria-hidden /> Registrar questões
                      </Botao>
                      <Botao tamanho="sm" variante="fantasma" onClick={() => setMateriaisDe(t)}>
                        <Link2 className="size-3.5" aria-hidden /> {mats.length ? `Materiais (${mats.length})` : 'Adicionar material'}
                      </Botao>
                      <Botao tamanho="sm" variante="fantasma" onClick={() => comecar(t)} aria-label={`Começar a estudar ${t.nome}`}>
                        <Play className="size-3.5" aria-hidden /> Estudar
                      </Botao>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {total && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave numeros">
            <span>
              Na meta: <strong className="font-semibold text-tinta">{total.feitas}</strong> {total.feitas === 1 ? 'questão' : 'questões'}
            </span>
            {total.feitas > 0 && <SeloAcerto pct={pctTotal} className="text-xs" />}
            {total.segundos > 0 && <span>· {formatarDuracao(total.segundos)} de estudo</span>}
          </p>
        )}

        <h3 className="mt-6 text-sm font-semibold text-tinta">
          <label htmlFor="meta-orientacoes">Orientações</label>
        </h3>
        <AreaTexto
          id="meta-orientacoes"
          className="mt-2 min-h-24"
          value={orientacoes}
          maxLength={LIMITE_ORIENTACOES}
          onChange={(e) => setOrientacoes(e.target.value)}
          onBlur={gravarOrientacoes}
          placeholder="Dicas para esta meta: o que cai mais, artigos para ler, pegadinhas…"
        />

        <div className="-mx-5 mt-6 flex flex-wrap items-center gap-2 border-t border-linha/70 px-5 pt-4 sm:-mx-6 sm:px-6">
          <Botao variante="fantasma" tamanho="icone" disabled={!anterior} onClick={() => anterior && (gravarOrientacoes(), aoMudarMeta(anterior.id))} aria-label="Meta anterior" title="Meta anterior">
            <ChevronLeft className="size-5" aria-hidden />
          </Botao>
          <span className="text-sm text-tinta-suave numeros">
            {indice + 1} de {irmas.length}
          </span>
          <Botao variante="fantasma" tamanho="icone" disabled={!proxima} onClick={() => proxima && (gravarOrientacoes(), aoMudarMeta(proxima.id))} aria-label="Próxima meta" title="Próxima meta">
            <ChevronRight className="size-5" aria-hidden />
          </Botao>
          <Botao className="ml-auto" onClick={() => comecar()} disabled={s.cumprida && !s.topicos.length}>
            <Play className="size-4" aria-hidden /> Começar
          </Botao>
        </div>
      </Dialogo>

      <EstudoDialog
        aberto={!!registrando}
        aoMudar={(a) => !a && setRegistrando(null)}
        iniciais={registrando ? { disciplinaId: registrando.disciplina_id, topicoId: registrando.id, categoria: 'Questões' } : undefined}
      />
      <MateriaisDialog topico={materiaisDe} materiais={materiaisDe ? (materiaisPorTopico.get(materiaisDe.id) ?? []) : []} aoFechar={() => setMateriaisDe(null)} />
    </>
  )
}
