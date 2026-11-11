import { Link } from 'react-router'
import { MapaCalor } from '@/components/MapaCalor'
import { PontosAtencao } from '@/components/PontosAtencao'
import { PorDisciplina } from '@/components/PorDisciplina'
import { CabecalhoPagina, Carregando, Painel } from '@/components/ui'
import { useDisciplinas, useEstudos, useTopicos } from '@/hooks/dados'

/** Raio-X: a visão detalhada da aprendizagem (intensidade no ano, cada disciplina e o que pede atenção) */
export function RaioX() {
  const estudos = useEstudos()
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()

  if (estudos.isLoading || disciplinas.isLoading || topicos.isLoading) return <Carregando />

  const listaDisciplinas = disciplinas.data ?? []
  const listaTopicos = topicos.data ?? []
  const listaEstudos = estudos.data ?? []

  return (
    <>
      <CabecalhoPagina titulo="Raio-X" subtitulo="Como está sua aprendizagem: onde você vai bem e o que pede atenção." />
      {listaDisciplinas.length === 0 ? (
        <Painel className="p-6 text-center sm:p-8">
          <p className="text-xl text-tinta">Ainda não há o que analisar</p>
          <p className="mx-auto mt-2 max-w-md text-tinta-suave">Monte o edital e registre seus estudos. O Raio-X aparece aqui conforme você avança.</p>
          <Link to="/edital" className="mt-5 inline-flex h-10 items-center rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria hover:bg-primaria-forte">
            Montar o edital
          </Link>
        </Painel>
      ) : (
        <div className="space-y-5">
          <MapaCalor estudos={listaEstudos} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-start">
            <PorDisciplina disciplinas={listaDisciplinas} topicos={listaTopicos} estudos={listaEstudos} />
            <PontosAtencao disciplinas={listaDisciplinas} topicos={listaTopicos} estudos={listaEstudos} />
          </div>
        </div>
      )}
    </>
  )
}
