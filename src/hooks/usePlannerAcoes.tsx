import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { EstudoDialog } from '@/components/EstudoDialog'
import { PlannerItemDialog } from '@/components/PlannerItemDialog'
import { Confirmar } from '@/components/ui'
import { useAtualizarItensPlanner, useDesmarcarItemPlanner, useExcluirItemPlanner, usePlanner } from './dados'
import { amanhaChave, chaveData, concluido, hojeChave, moverItem, paraData, reagendar } from '@/lib/planner'
import { mensagemErro } from '@/lib/utils'
import type { ItemPlanner } from '@/types'

/** O que a página Estudar recebe ao dar play num item do planner */
export interface PlayDoPlanner {
  id: string
  disciplinaId: string
  topicoId: string | null
  minutos: number | null
}

/** "hoje", "amanhã", "ontem" ou "qua., 18/11" */
export function nomeDoDia(chave: string) {
  if (chave === hojeChave()) return 'hoje'
  if (chave === amanhaChave()) return 'amanhã'
  if (chave === chaveData(subDays(new Date(), 1))) return 'ontem'
  return format(paraData(chave), 'EEE, dd/MM', { locale: ptBR })
}

/**
  Ações sobre os itens do planner (concluir, desmarcar, dar play, mover, editar, excluir)
  e os diálogos que elas abrem. Quem usa precisa renderizar `dialogos`.
*/
export function usePlannerAcoes() {
  const navegar = useNavigate()
  const planner = usePlanner()
  const atualizar = useAtualizarItensPlanner()
  const excluir = useExcluirItemPlanner()
  const desmarcar = useDesmarcarItemPlanner()

  const [concluindo, setConcluindo] = useState<ItemPlanner | null>(null)
  const [formulario, setFormulario] = useState<{ item?: ItemPlanner; data?: string } | null>(null)
  const [excluindo, setExcluindo] = useState<ItemPlanner | null>(null)
  const [desmarcando, setDesmarcando] = useState<ItemPlanner | null>(null)

  const todos = planner.data ?? []

  const gravar = (itens: ItemPlanner[], sucesso?: string) =>
    atualizar.mutate(itens, {
      onSuccess: () => sucesso && toast.success(sucesso),
      onError: (e) => toast.error(`Não deu para salvar a mudança: ${mensagemErro(e)}`),
    })

  const acoes = {
    /** Check: pendente abre o registro do estudo; concluído desfaz */
    alternar(item: ItemPlanner) {
      if (!concluido(item)) return setConcluindo(item)
      if (item.estudo_id) return setDesmarcando(item)
      gravar([{ ...item, concluido_em: null }])
    },
    /** Play: abre o relógio já com a disciplina e o tópico do item */
    jogar(item: ItemPlanner) {
      const play: PlayDoPlanner = { id: item.id, disciplinaId: item.disciplina_id, topicoId: item.topico_id, minutos: item.minutos_previstos }
      navegar('/estudar', { state: { planner: play } })
    },
    mover(item: ItemPlanner, data: string) {
      if (data === item.data) return
      gravar([moverItem(item, data, todos)], `Movido para ${nomeDoDia(data)}.`)
    },
    reagendar(itens: ItemPlanner[], inicio: string, porDia: number) {
      if (!itens.length) return
      gravar(reagendar(itens, inicio, porDia, todos), itens.length === 1 ? 'Item reagendado.' : `${itens.length} itens reagendados.`)
    },
    novo(data?: string) {
      setFormulario({ data })
    },
    editar(item: ItemPlanner) {
      setFormulario({ item })
    },
    excluir(item: ItemPlanner) {
      setExcluindo(item)
    },
    ocupado: atualizar.isPending,
  }

  const dialogos = (
    <>
      <EstudoDialog
        aberto={concluindo !== null}
        aoMudar={(a) => !a && setConcluindo(null)}
        iniciais={
          concluindo
            ? {
                disciplinaId: concluindo.disciplina_id,
                topicoId: concluindo.topico_id ?? undefined,
                duracaoSegundos: (concluindo.minutos_previstos ?? 0) * 60,
                origem: 'manual',
                plannerItemId: concluindo.id,
              }
            : undefined
        }
        aoSoConcluir={() => concluindo && gravar([{ ...concluindo, concluido_em: new Date().toISOString() }], 'Item marcado como feito.')}
      />
      <PlannerItemDialog aberto={formulario !== null} aoMudar={(a) => !a && setFormulario(null)} item={formulario?.item} dataInicial={formulario?.data} />
      <Confirmar
        aberto={excluindo !== null}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir do planner?"
        texto={
          excluindo?.estudo_id
            ? 'O item sai do planner. O estudo que você registrou continua no histórico.'
            : 'O item sai do planner. Isso não pode ser desfeito.'
        }
        textoBotao="Excluir item"
        carregando={excluir.isPending}
        aoConfirmar={() =>
          excluindo &&
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              toast.success('Item excluído.')
              setExcluindo(null)
            },
            onError: (e) => toast.error(`Não deu para excluir: ${mensagemErro(e)}`),
          })
        }
      />
      <Confirmar
        aberto={desmarcando !== null}
        aoMudar={(a) => !a && setDesmarcando(null)}
        titulo="Desmarcar este item?"
        texto="Ele volta a ficar pendente e o estudo registrado ao concluir sai do histórico."
        textoBotao="Desmarcar e apagar estudo"
        carregando={desmarcar.isPending}
        aoConfirmar={() =>
          desmarcando &&
          desmarcar.mutate(desmarcando, {
            onSuccess: () => {
              toast.success('Item desmarcado.')
              setDesmarcando(null)
            },
            onError: (e) => toast.error(`Não deu para desmarcar: ${mensagemErro(e)}`),
          })
        }
      />
    </>
  )

  return { ...acoes, dialogos }
}

export type AcoesPlanner = Omit<ReturnType<typeof usePlannerAcoes>, 'dialogos'>
