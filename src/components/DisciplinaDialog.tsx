import { Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useSalvarDisciplina } from '@/hooks/dados'
import { CORES_DISCIPLINA, cn, mensagemErro } from '@/lib/utils'
import type { Disciplina } from '@/types'
import { Botao, Campo, Dialogo, Entrada } from './ui'

export function DisciplinaDialog({
  aberto,
  aoMudar,
  editando,
  proximaOrdem,
  coresUsadas,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  editando?: Disciplina | null
  proximaOrdem: number
  coresUsadas: string[]
}) {
  const salvar = useSalvarDisciplina()
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES_DISCIPLINA[0])
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setNome(editando?.nome ?? '')
    setCor(editando?.cor ?? CORES_DISCIPLINA.find((c) => !coresUsadas.includes(c)) ?? CORES_DISCIPLINA[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return setErro('Dê um nome à disciplina.')
    try {
      await salvar.mutateAsync({ id: editando?.id, nome, cor, ordem: editando ? undefined : proximaOrdem })
      toast.success(editando ? 'Disciplina atualizada.' : 'Disciplina criada.')
      aoMudar(false)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo={editando ? 'Editar disciplina' : 'Nova disciplina'} largura="max-w-md">
      <form onSubmit={enviar} className="space-y-5">
        <Campo rotulo="Nome" htmlFor="d-nome" erro={erro}>
          <Entrada id="d-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Direito do Trabalho" />
        </Campo>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-tinta">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {CORES_DISCIPLINA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                className={cn('grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-superficie transition', cor === c && 'ring-2 ring-tinta/60')}
                style={{ background: c }}
              >
                {cor === c && <Check className="size-4 text-white" aria-hidden />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            {editando ? 'Salvar' : 'Criar disciplina'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
