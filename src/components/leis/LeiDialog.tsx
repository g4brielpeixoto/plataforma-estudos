import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useDisciplinas, useExcluirLei, useSalvarLei } from '@/hooks/dados'
import { mensagemErro } from '@/lib/utils'
import type { Lei } from '@/types'
import { Botao, Campo, Confirmar, Dialogo, Entrada, Selecao } from '../ui'

/** Criar ou editar uma lei (nome e disciplina); na edição, também excluir */
export function LeiDialog({ aberto, aoMudar, lei, aoCriar, aoExcluir }: { aberto: boolean; aoMudar: (v: boolean) => void; lei?: Lei | null; aoCriar?: (id: string) => void; aoExcluir?: () => void }) {
  const disciplinas = useDisciplinas()
  const salvar = useSalvarLei()
  const excluir = useExcluirLei()
  const [nome, setNome] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setErro('')
    setNome(lei?.nome ?? '')
    setDisciplinaId(lei?.disciplina_id ?? '')
  }, [aberto, lei])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const limpo = nome.trim()
    if (!limpo) return setErro('Escreva o nome da lei.')
    if (limpo.length > 120) return setErro('O nome pode ter até 120 caracteres.')
    if (!disciplinaId) return setErro('Escolha a disciplina da lei.')
    try {
      const id = await salvar.mutateAsync({ id: lei?.id, nome: limpo, disciplina_id: disciplinaId })
      toast.success(lei ? 'Lei atualizada.' : 'Lei criada.')
      aoMudar(false)
      if (!lei) aoCriar?.(id)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  const semDisciplinas = !disciplinas.isLoading && (disciplinas.data ?? []).length === 0

  return (
    <>
      <Dialogo aberto={aberto} aoMudar={aoMudar} titulo={lei ? 'Editar lei' : 'Nova lei'} descricao="A disciplina dá a cor da lei e é o baralho dos flashcards criados nela.">
        {semDisciplinas ? (
          <div className="rounded-2xl bg-superficie-2 p-5 text-center">
            <p className="font-medium text-tinta">Você ainda não tem disciplinas.</p>
            <p className="mt-1 text-sm text-tinta-suave">Cada lei fica ligada a uma disciplina do edital. Cadastre o edital primeiro.</p>
            <Link to="/edital" onClick={() => aoMudar(false)} className="mt-4 inline-flex h-10 items-center rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria">
              Ir para o edital
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <Campo rotulo="Nome da lei" htmlFor="lei-nome">
              <Entrada id="lei-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: CLT, Lei 8.112/90, Constituição Federal" maxLength={120} autoFocus />
            </Campo>
            <Campo rotulo="Disciplina" htmlFor="lei-disciplina">
              <Selecao id="lei-disciplina" value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)}>
                <option value="">Escolha…</option>
                {(disciplinas.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
            {erro && (
              <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
                {erro}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              {lei && (
                <Botao type="button" variante="fantasma" className="text-ruim" onClick={() => setConfirmando(true)}>
                  Excluir lei
                </Botao>
              )}
              <span className="flex-1" />
              <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
                Cancelar
              </Botao>
              <Botao type="submit" carregando={salvar.isPending}>
                {lei ? 'Salvar' : 'Criar lei'}
              </Botao>
            </div>
          </form>
        )}
      </Dialogo>
      <Confirmar
        aberto={confirmando}
        aoMudar={setConfirmando}
        titulo={`Excluir "${lei?.nome ?? ''}"?`}
        texto="Todas as anotações desta lei são apagadas. Os flashcards criados a partir dela continuam no baralho."
        textoBotao="Excluir lei"
        carregando={excluir.isPending}
        aoConfirmar={async () => {
          if (!lei) return
          try {
            await excluir.mutateAsync(lei.id)
            toast.success('Lei excluída.')
            setConfirmando(false)
            aoMudar(false)
            aoExcluir?.()
          } catch (err) {
            toast.error(`Não foi possível excluir: ${mensagemErro(err)}`)
          }
        }}
      />
    </>
  )
}
