import { differenceInCalendarDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Timer } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '@/components/Avatar'
import { Constancia } from '@/components/Constancia'
import { ContagemProvas } from '@/components/ContagemProvas'
import { EstudoDialog } from '@/components/EstudoDialog'
import { EstudoSemanal } from '@/components/EstudoSemanal'
import { MapaCalor } from '@/components/MapaCalor'
import { MetasSemanais } from '@/components/MetasSemanais'
import { ResumoTopo } from '@/components/ResumoTopo'
import { TempoPizza } from '@/components/TempoPizza'
import { BarraProgresso, Botao, Carregando, Painel, SeloAcerto } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useDisciplinas, useEstudos, useTopicos } from '@/hooks/dados'
import { primeiroNome } from '@/lib/foto'
import { calcularIndicadores, resumirPorTopico } from '@/lib/indicadores'
import { formatarDuracao } from '@/lib/utils'

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const tituloCard = 'text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase'

export function Inicio() {
  const estudos = useEstudos()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const navegar = useNavigate()
  const { perfil } = useAuth()
  const nome = primeiroNome(perfil?.nome)
  const [adicionando, setAdicionando] = useState(false)
  const heatmap = useRef<HTMLDivElement>(null)

  const todos = estudos.data ?? []

  const porDisciplina = useMemo(() => {
    const topicoParaDisciplina = new Map((topicos.data ?? []).map((t) => [t.id, t.disciplina_id]))
    return (disciplinas.data ?? []).map((d) => {
      const meus = (topicos.data ?? []).filter((t) => t.disciplina_id === d.id)
      const est = (estudos.data ?? []).filter((e) => topicoParaDisciplina.get(e.topico_id) === d.id)
      return { disciplina: d, ...calcularIndicadores(est, meus) }
    })
  }, [disciplinas.data, topicos.data, estudos.data])

  const atencao = useMemo(() => {
    const resumo = resumirPorTopico(estudos.data ?? [])
    const nomeDisciplina = new Map((disciplinas.data ?? []).map((d) => [d.id, d]))
    const lista = (topicos.data ?? []).map((t) => ({ topico: t, disciplina: nomeDisciplina.get(t.disciplina_id), resumo: resumo.get(t.id) }))
    const piores = lista
      .filter((x) => x.resumo && x.resumo.questoesFeitas >= 5 && x.resumo.acertoPct !== null && x.resumo.acertoPct < 80)
      .sort((a, b) => (a.resumo!.acertoPct ?? 0) - (b.resumo!.acertoPct ?? 0))
      .slice(0, 5)
    const parados = lista
      .filter((x) => !x.topico.concluido && x.resumo?.ultimoEstudo)
      .sort((a, b) => a.resumo!.ultimoEstudo!.localeCompare(b.resumo!.ultimoEstudo!))
      .slice(0, 5)
    return { piores, parados }
  }, [estudos.data, topicos.data, disciplinas.data])

  const carregando = estudos.isLoading || topicos.isLoading || disciplinas.isLoading
  const semEdital = !carregando && (disciplinas.data ?? []).length === 0

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/perfil" aria-label="Meu perfil" className="shrink-0 rounded-full">
            <Avatar nome={perfil?.nome} email={perfil?.email} foto={perfil?.foto_url} tamanho={56} />
          </Link>
          <div className="min-w-0">
            <p className="text-tinta-suave">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
            <h1 className="font-serif text-[1.85rem] leading-tight font-medium tracking-[-0.01em] text-tinta">
              {saudacao()}
              {nome ? `, ${nome}` : ''}!
            </h1>
            {!nome && (
              <Link to="/perfil" className="text-sm font-medium text-primaria-forte underline-offset-2 hover:underline dark:text-primaria">
                Adicione seu nome e sua foto
              </Link>
            )}
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Botao variante="secundario" onClick={() => setAdicionando(true)} className="h-11 px-3 text-sm sm:h-10 sm:px-4 sm:text-[15px]">
            <Plus className="size-4" aria-hidden /> Adicionar estudo
          </Botao>
          <Botao onClick={() => navegar('/estudar')} className="h-11 px-3 text-sm sm:h-10 sm:px-4 sm:text-[15px]">
            <Timer className="size-4" aria-hidden /> Estudar agora
          </Botao>
        </div>
      </div>

      {carregando ? (
        <Carregando />
      ) : semEdital ? (
        <div className="space-y-5">
          <Painel className="p-6 text-center sm:p-8">
            <p className="font-serif text-xl text-tinta">Vamos montar seu edital?</p>
            <p className="mx-auto mt-2 max-w-md text-tinta-suave">
              Cadastre as disciplinas e os tópicos (ou cole o edital inteiro). Depois é só estudar e registrar: os indicadores aparecem aqui.
            </p>
            <Link to="/edital" className="mt-5 inline-flex h-10 items-center rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria hover:bg-primaria-forte">
              Montar o edital
            </Link>
          </Painel>
          <ContagemProvas />
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. resumos do topo: tempo, desempenho, edital e versículo */}
          <ResumoTopo estudos={todos} topicos={topicos.data ?? []} />

          {/* 2. constância, de ponta a ponta */}
          <Constancia estudos={todos} aoVerDetalhes={() => heatmap.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

          {/* 3. duas colunas: análise à esquerda, acompanhamento da semana à direita */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="order-2 space-y-5 xl:order-1">
              <div ref={heatmap} className="scroll-mt-24">
                <MapaCalor estudos={todos} />
              </div>

              <Painel className="p-5 sm:p-6">
                <h2 className={tituloCard}>Por disciplina</h2>
                <ul className="mt-4 space-y-4">
                  {porDisciplina.map((x) => (
                    <li key={x.disciplina.id}>
                      <Link to={`/edital/${x.disciplina.id}`} className="group block">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2 font-medium text-tinta group-hover:text-primaria-forte">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.disciplina.cor }} aria-hidden />
                            <span className="truncate">{x.disciplina.nome}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-tinta-suave numeros">
                            {x.tempoSegundos > 0 && formatarDuracao(x.tempoSegundos)}
                            <SeloAcerto pct={x.acertoPct} className="text-xs" />
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <BarraProgresso valor={x.progressoPct} cor={x.disciplina.cor} rotulo={`Progresso em ${x.disciplina.nome}`} />
                          <span className="w-20 shrink-0 text-right text-xs text-tinta-suave numeros">
                            {x.topicosConcluidos}/{x.topicosTotal} tópicos
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Painel>

              <Painel className="p-5 sm:p-6">
                <h2 className={tituloCard}>Pontos de atenção</h2>
                <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-tinta">Menor acerto</h3>
                    {atencao.piores.length === 0 ? (
                      <p className="mt-1 text-sm text-tinta-suave">Nenhum tópico abaixo de 80% (com pelo menos 5 questões).</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {atencao.piores.map((x) => (
                          <li key={x.topico.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="block truncate text-tinta">{x.topico.nome}</span>
                              <span className="block truncate text-xs text-tinta-suave">{x.disciplina?.nome}</span>
                            </span>
                            <SeloAcerto pct={x.resumo!.acertoPct} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-tinta">Há mais tempo sem estudar</h3>
                    {atencao.parados.length === 0 ? (
                      <p className="mt-1 text-sm text-tinta-suave">Nada por aqui ainda.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {atencao.parados.map((x) => (
                          <li key={x.topico.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="block truncate text-tinta">{x.topico.nome}</span>
                              <span className="block truncate text-xs text-tinta-suave">{x.disciplina?.nome}</span>
                            </span>
                            <span className="shrink-0 text-xs text-tinta-suave numeros">
                              {differenceInCalendarDays(new Date(), new Date(x.resumo!.ultimoEstudo!))} dias
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Painel>
            </div>

            <div className="order-1 space-y-5 xl:order-2">
              <ContagemProvas />
              <MetasSemanais estudos={todos} />
              <EstudoSemanal estudos={todos} />
              <TempoPizza estudos={todos} topicos={topicos.data ?? []} disciplinas={disciplinas.data ?? []} />
            </div>
          </div>
        </div>
      )}

      <EstudoDialog aberto={adicionando} aoMudar={setAdicionando} />
    </>
  )
}
