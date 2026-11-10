import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useExcluirProva, useProvas, useSalvarProva } from '@/hooks/dados'
import { dataProvaPorExtenso, diasParaProva, seloProva } from '@/lib/provas'
import { cn, mensagemErro } from '@/lib/utils'
import type { Prova } from '@/types'
import { Botao, Campo, Confirmar, Dialogo, Entrada } from './ui'

/** Cadastro das provas: adicionar, editar e excluir */
export function ProvasDialog({ aberto, aoMudar }: { aberto: boolean; aoMudar: (a: boolean) => void }) {
  const provas = useProvas()
  const salvar = useSalvarProva()
  const excluir = useExcluirProva()
  const [editando, setEditando] = useState<Prova | null>(null)
  const [nome, setNome] = useState('')
  const [data, setData] = useState('')
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState<Prova | null>(null)

  const limpar = () => {
    setEditando(null)
    setNome('')
    setData('')
    setErro('')
  }
  useEffect(() => {
    if (aberto) limpar()
  }, [aberto])

  const editar = (p: Prova) => {
    setEditando(p)
    setNome(p.nome)
    setData(p.data)
    setErro('')
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Dê um nome à prova.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro('Escolha a data da prova.')
    try {
      await salvar.mutateAsync({ id: editando?.id, nome, data })
      toast.success(editando ? 'Prova atualizada.' : 'Prova adicionada.')
      limpar()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluir.mutateAsync(excluindo.id)
      toast.success('Prova excluída.')
      if (editando?.id === excluindo.id) limpar()
      setExcluindo(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  const lista = provas.data ?? []

  return (
    <>
      <Dialogo aberto={aberto} aoMudar={aoMudar} titulo="Datas das provas" descricao="Cadastre e acompanhe os dias que faltam para seus concursos e exames." largura="max-w-2xl">
        <form onSubmit={enviar}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Campo rotulo="Nome da prova ou concurso" htmlFor="pv-nome">
              <Entrada id="pv-nome" autoFocus value={nome} maxLength={120} placeholder="Ex.: TRT 8" onChange={(e) => setNome(e.target.value)} />
            </Campo>
            <Campo rotulo="Data" htmlFor="pv-data">
              <Entrada id="pv-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="numeros" />
            </Campo>
          </div>
          {erro && (
            <p role="alert" className="mt-3 rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
              {erro}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {editando && (
              <Botao type="button" variante="secundario" onClick={limpar}>
                Cancelar edição
              </Botao>
            )}
            <Botao type="submit" carregando={salvar.isPending} disabled={!nome.trim() || !data}>
              {editando ? 'Salvar alterações' : 'Adicionar prova'}
            </Botao>
          </div>
        </form>

        <h3 className="mt-6 mb-2 text-sm font-semibold text-tinta">Provas cadastradas</h3>
        {lista.length === 0 ? (
          <p className="rounded-xl bg-superficie-2 px-4 py-5 text-center text-sm text-tinta-suave">Nenhuma prova cadastrada ainda.</p>
        ) : (
          <ul className="divide-y divide-linha/70 rounded-xl border border-linha/70 bg-superficie-2/50">
            {lista.map((p) => {
              const passou = diasParaProva(p) < 0
              return (
                <li key={p.id} className={cn('flex items-center gap-3 px-4 py-3', editando?.id === p.id && 'bg-nevoa/60')}>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate font-medium', passou ? 'text-tinta-suave' : 'text-tinta')}>{p.nome}</p>
                    <p className="text-sm text-tinta-suave">{dataProvaPorExtenso(p)}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase numeros',
                      passou ? 'bg-superficie-2 text-tinta-suave' : 'bg-nevoa text-primaria-forte dark:text-primaria',
                    )}
                  >
                    {seloProva(p)}
                  </span>
                  <Botao variante="fantasma" tamanho="icone" aria-label={`Editar ${p.nome}`} onClick={() => editar(p)}>
                    <Pencil className="size-4" />
                  </Botao>
                  <Botao variante="fantasma" tamanho="icone" aria-label={`Excluir ${p.nome}`} onClick={() => setExcluindo(p)}>
                    <Trash2 className="size-4" />
                  </Botao>
                </li>
              )
            })}
          </ul>
        )}
      </Dialogo>

      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir prova?"
        texto={`"${excluindo?.nome ?? ''}" sai da contagem regressiva. Seus estudos não são afetados.`}
        textoBotao="Excluir prova"
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </>
  )
}
