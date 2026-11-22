import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, CalendarClock, Plus, ScanSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Constancia } from '@/components/Constancia'
import { ContagemProvas } from '@/components/ContagemProvas'
import { EstudoDialog } from '@/components/EstudoDialog'
import { EstudoSemanal } from '@/components/EstudoSemanal'
import { MetasSemanais } from '@/components/MetasSemanais'
import { MetaDaVez } from '@/components/ciclos/MetaDaVez'
import { MetaDialog } from '@/components/ciclos/MetaDialog'
import { ResumoTopo } from '@/components/ResumoTopo'
import { TempoPizza } from '@/components/TempoPizza'
import { Botao, Carregando, Painel } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { VersiculoMini } from '@/components/VersiculoCard'
import { useDisciplinas, useEstudos, useProvas, useTopicos } from '@/hooks/dados'
import { useCicloDados } from '@/hooks/useCicloDados'
import { primeiroNome } from '@/lib/foto'
import { provasFuturas, seloProva } from '@/lib/provas'

/** A meta da vez do ciclo (no lugar do antigo planejamento de hoje), com o detalhe da meta */
function MetaDaVezInicio() {
  const dados = useCicloDados()
  const [aberta, setAberta] = useState<string | null>(null)
  if (dados.carregando) return null
  return (
    <>
      <MetaDaVez dados={dados} aoAbrir={setAberta} />
      <MetaDialog dados={dados} metaId={aberta} aoMudarMeta={setAberta} />
    </>
  )
}

/** Prova mais próxima numa linha discreta embaixo da saudação (só no celular; o cartão completo fica mais abaixo) */
function ProximaProva() {
  const provas = useProvas()
  const proxima = useMemo(() => provasFuturas(provas.data ?? [])[0], [provas.data])
  if (!proxima) return null
  return (
    <p className="mt-1.5 text-sm leading-snug text-tinta-suave sm:hidden">
      <CalendarClock className="mr-1.5 inline size-4 -translate-y-px align-middle text-primaria" aria-hidden />
      <span className="font-medium text-tinta">{proxima.nome}</span>
      <span aria-hidden> · </span>
      <span className="whitespace-nowrap numeros">{seloProva(proxima).replace(/^F/, 'f').replace(/^É/, 'é')}</span>
    </p>
  )
}

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function Inicio() {
  const estudos = useEstudos()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const navegar = useNavigate()
  const { perfil } = useAuth()
  const nome = primeiroNome(perfil?.nome)
  const [adicionando, setAdicionando] = useState(false)

  const todos = estudos.data ?? []

  const carregando = estudos.isLoading || topicos.isLoading || disciplinas.isLoading
  const semEdital = !carregando && (disciplinas.data ?? []).length === 0

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6 sm:flex-wrap sm:items-end">
        <div className="min-w-0">
          <p className="text-sm text-tinta-suave sm:text-base">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          <h1 className="text-[1.4rem] leading-tight font-medium tracking-[-0.01em] text-tinta sm:text-[1.85rem]">
            {saudacao()}
            {nome ? `, ${nome}` : ''}!
          </h1>
          {!nome && (
            <Link to="/perfil" className="text-sm font-medium text-primaria-forte underline-offset-2 hover:underline dark:text-primaria">
              Adicione seu nome e sua foto
            </Link>
          )}
          <ProximaProva />
        </div>
        {/* o cronômetro abre pelo botão redondo fixo no canto da tela (MiniCronometro) */}
        <Botao onClick={() => setAdicionando(true)} aria-label="Adicionar estudo" className="mt-1 h-10 shrink-0 px-3.5 text-sm sm:mt-0 sm:px-4 sm:text-[15px]">
          <Plus className="size-4" aria-hidden /> <span className="sm:hidden">Estudo</span>
          <span className="hidden sm:inline">Adicionar estudo</span>
        </Botao>
      </div>

      {carregando ? (
        <Carregando />
      ) : semEdital ? (
        <div className="space-y-5">
          <Painel className="p-6 text-center sm:p-8">
            <p className="text-xl text-tinta">Vamos montar seu edital?</p>
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
        // no celular tudo vira uma coluna só (as caixas internas ficam em `contents`) e a ordem vem das classes order-*:
        // versículo, resumos, planejamento, constância, provas, metas, estudo semanal, tempo de estudo, Raio-X
        <div className="flex flex-col gap-4 sm:gap-5">
          <VersiculoMini className="px-4 pt-7 pb-4 sm:hidden" />

          {/* 1. resumos do topo: tempo, desempenho, edital e versículo */}
          <ResumoTopo estudos={todos} topicos={topicos.data ?? []} />

          {/* 2. constância, de ponta a ponta (no celular, logo depois da meta da vez) */}
          <Constancia estudos={todos} aoVerDetalhes={() => navegar('/raio-x')} className="order-2 sm:order-none" />

          {/* 3. acompanhamento do dia e da semana; a análise detalhada fica no Raio-X */}
          <div className="contents xl:grid xl:grid-cols-2 xl:items-start xl:gap-5">
            <div className="contents xl:block xl:space-y-5">
              <div className="order-1 space-y-5">
                <MetaDaVezInicio />
              </div>
              <EstudoSemanal estudos={todos} className="order-4" />
              <Link
                to="/raio-x"
                className="order-6 flex items-center gap-4 rounded-2xl border border-linha/70 bg-superficie p-5 transition-colors hover:border-lilas sm:p-6"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-nevoa text-primaria-forte dark:text-primaria">
                  <ScanSearch className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">Raio-X da aprendizagem</span>
                  <span className="block text-sm text-tinta-suave">Heatmap do ano, números por disciplina e pontos de atenção.</span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-tinta-suave" aria-hidden />
              </Link>
            </div>
            <div className="contents xl:block xl:space-y-5">
              <div className="order-2">
                <ContagemProvas />
              </div>
              <div className="order-3">
                <MetasSemanais estudos={todos} />
              </div>
              <div className="order-5">
                <TempoPizza estudos={todos} disciplinas={disciplinas.data ?? []} />
              </div>
            </div>
          </div>
        </div>
      )}

      <EstudoDialog aberto={adicionando} aoMudar={setAdicionando} />
    </>
  )
}
