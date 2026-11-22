import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { DividirMetasDialog } from '@/components/ciclos/DividirMetasDialog'
import { EditarCicloDialog } from '@/components/ciclos/EditarCicloDialog'
import { MetaDaVez } from '@/components/ciclos/MetaDaVez'
import { MetaDialog } from '@/components/ciclos/MetaDialog'
import { QuadroMetas } from '@/components/ciclos/QuadroMetas'
import { RodaCiclo } from '@/components/ciclos/RodaCiclo'
import { Botao, CabecalhoPagina, Carregando, Painel } from '@/components/ui'
import { useCicloDados } from '@/hooks/useCicloDados'
import { mensagemErro } from '@/lib/utils'
import type { Disciplina } from '@/types'

/**
  Ciclos de metas: a meta da vez, a roda com a ordem das disciplinas e o quadro de metas.
  As metas são grupos de tópicos do edital; meta cumprida = todos os tópicos dela concluídos.
*/
export function Ciclos() {
  const dados = useCicloDados()
  const [metaAberta, setMetaAberta] = useState<string | null>(null)
  const [dividindo, setDividindo] = useState<Disciplina | null>(null)
  const [editando, setEditando] = useState(false)

  if (dados.carregando) return <Carregando texto="Carregando o ciclo…" />
  if (dados.erro) return <p className="rounded-xl bg-ruim-fundo p-4 text-ruim">Não deu para carregar o ciclo. {mensagemErro(dados.erro)} Recarregue a página.</p>

  return (
    <div>
      <CabecalhoPagina
        titulo="Ciclos"
        subtitulo="Uma meta por vez, revezando as disciplinas."
        acoes={
          <Botao variante="secundario" onClick={() => setEditando(true)}>
            <Settings2 className="size-4" aria-hidden /> Editar ciclo
          </Botao>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:items-start">
        <div className="space-y-5">
          <MetaDaVez dados={dados} aoAbrir={setMetaAberta} comPular />
          <div className="xl:hidden">
            <PainelRoda dados={dados} aoAbrir={setMetaAberta} aoEditar={() => setEditando(true)} />
          </div>
          <QuadroMetas dados={dados} aoAbrir={setMetaAberta} aoDividir={setDividindo} />
        </div>
        <div className="hidden xl:sticky xl:top-8 xl:block">
          <PainelRoda dados={dados} aoAbrir={setMetaAberta} aoEditar={() => setEditando(true)} />
        </div>
      </div>

      <MetaDialog dados={dados} metaId={metaAberta} aoMudarMeta={setMetaAberta} />
      <DividirMetasDialog dados={dados} disciplina={dividindo} aoFechar={() => setDividindo(null)} />
      <EditarCicloDialog dados={dados} aberto={editando} aoMudar={setEditando} />
    </div>
  )
}

function PainelRoda({ dados, aoAbrir, aoEditar }: { dados: ReturnType<typeof useCicloDados>; aoAbrir: (id: string) => void; aoEditar: () => void }) {
  return (
    <Painel className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-tinta-suave uppercase">Ciclo</h2>
        {dados.sequencia.length > 0 && <span className="text-xs text-tinta-suave numeros">{dados.sequencia.length} etapas</span>}
      </div>
      <div className="mt-4 flex justify-center">
        <RodaCiclo dados={dados} aoAbrir={aoAbrir} aoEditar={aoEditar} />
      </div>
      {dados.sequencia.length > 0 && <p className="mt-4 text-center text-xs text-tinta-suave">Passe o mouse ou toque numa disciplina para ver a próxima meta dela.</p>}
    </Painel>
  )
}
