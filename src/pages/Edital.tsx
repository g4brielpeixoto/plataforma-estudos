import { BookOpen, FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { DisciplinaDialog } from '@/components/DisciplinaDialog'
import { ImportarDialog } from '@/components/ImportarDialog'
import { BarraProgresso, Botao, CabecalhoPagina, Carregando, Confirmar, Painel, SeloAcerto, Vazio } from '@/components/ui'
import { useDisciplinas, useEstudos, useExcluirDisciplina, useTopicos } from '@/hooks/dados'
import { porcentagem, formatarDuracao, mensagemErro } from '@/lib/utils'
import type { Disciplina } from '@/types'

export function Edital() {
  const disciplinas = useDisciplinas()
  const topicos = useTopicos()
  const estudos = useEstudos()
  const excluir = useExcluirDisciplina()
  const [dialogo, setDialogo] = useState<{ aberto: boolean; editando: Disciplina | null }>({ aberto: false, editando: null })
  const [importando, setImportando] = useState(false)
  const [excluindo, setExcluindo] = useState<Disciplina | null>(null)

  const resumo = useMemo(() => {
    const r = new Map<string, { total: number; concluidos: number; feitas: number; acertadas: number; tempo: number }>()
    for (const d of disciplinas.data ?? []) r.set(d.id, { total: 0, concluidos: 0, feitas: 0, acertadas: 0, tempo: 0 })
    for (const t of topicos.data ?? []) {
      const x = r.get(t.disciplina_id)
      if (!x) continue
      x.total++
      if (t.concluido) x.concluidos++
    }
    for (const e of estudos.data ?? []) {
      const x = r.get(e.disciplina_id)
      if (!x) continue
      x.feitas += e.questoes_feitas ?? 0
      x.acertadas += e.questoes_acertadas ?? 0
      x.tempo += e.duracao_segundos ?? 0
    }
    return r
  }, [disciplinas.data, topicos.data, estudos.data])

  const lista = disciplinas.data ?? []
  const totalTopicos = topicos.data?.length ?? 0
  const totalConcluidos = (topicos.data ?? []).filter((t) => t.concluido).length

  const confirmarExclusao = async () => {
    if (!excluindo) return
    try {
      await excluir.mutateAsync(excluindo.id)
      toast.success(`"${excluindo.nome}" foi excluída.`)
      setExcluindo(null)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Edital"
        subtitulo={
          lista.length
            ? `${lista.length} ${lista.length === 1 ? 'disciplina' : 'disciplinas'} · ${totalConcluidos} de ${totalTopicos} tópicos concluídos`
            : 'Suas disciplinas e os tópicos de cada uma.'
        }
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setImportando(true)}>
              <FileUp className="size-4" aria-hidden /> Importar edital
            </Botao>
            <Botao onClick={() => setDialogo({ aberto: true, editando: null })}>
              <Plus className="size-4" aria-hidden /> Nova disciplina
            </Botao>
          </>
        }
      />

      {disciplinas.isLoading || topicos.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Painel>
          <Vazio
            icone={<BookOpen className="size-9" />}
            titulo="Comece pelo edital"
            texto="Crie as disciplinas uma a uma ou cole o edital inteiro de uma vez com a importação."
            acao={
              <div className="flex flex-wrap justify-center gap-2">
                <Botao variante="secundario" onClick={() => setImportando(true)}>
                  <FileUp className="size-4" aria-hidden /> Importar edital
                </Botao>
                <Botao onClick={() => setDialogo({ aberto: true, editando: null })}>
                  <Plus className="size-4" aria-hidden /> Nova disciplina
                </Botao>
              </div>
            }
          />
        </Painel>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
          {lista.map((d) => {
            const r = resumo.get(d.id)!
            const progresso = porcentagem(r.concluidos, r.total)
            return (
              <li key={d.id} className="group relative flex flex-col rounded-2xl border border-linha/70 bg-superficie p-5 transition-colors hover:border-lilas">
                <span className="absolute inset-y-5 left-0 w-1 rounded-r-full" style={{ background: d.cor }} aria-hidden />
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/edital/${d.id}`} className="font-semibold leading-snug text-tinta after:absolute after:inset-0 after:content-['']">
                    {d.nome}
                  </Link>
                  <div className="relative z-10 -mt-1 -mr-2 flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <Botao variante="fantasma" tamanho="icone" aria-label={`Editar ${d.nome}`} onClick={() => setDialogo({ aberto: true, editando: d })}>
                      <Pencil className="size-4" />
                    </Botao>
                    <Botao variante="fantasma" tamanho="icone" aria-label={`Excluir ${d.nome}`} onClick={() => setExcluindo(d)}>
                      <Trash2 className="size-4" />
                    </Botao>
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between text-sm text-tinta-suave numeros">
                  <span>
                    {r.concluidos} de {r.total} {r.total === 1 ? 'tópico' : 'tópicos'}
                  </span>
                  <span className="font-semibold text-tinta">{progresso ?? 0}%</span>
                </div>
                <BarraProgresso valor={progresso} cor={d.cor} className="mt-1.5" rotulo={`Progresso em ${d.nome}`} />
                <div className="mt-4 flex items-center justify-between text-sm text-tinta-suave numeros">
                  <span>{formatarDuracao(r.tempo)} estudados</span>
                  <span className="flex items-center gap-1.5">
                    {r.feitas} questões <SeloAcerto pct={porcentagem(r.acertadas, r.feitas)} />
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <DisciplinaDialog
        aberto={dialogo.aberto}
        aoMudar={(a) => setDialogo((s) => ({ ...s, aberto: a }))}
        editando={dialogo.editando}
        proximaOrdem={lista.reduce((m, d) => Math.max(m, d.ordem), -1) + 1}
        coresUsadas={lista.map((d) => d.cor)}
      />
      <ImportarDialog aberto={importando} aoMudar={setImportando} modo="edital" disciplinas={lista} topicos={topicos.data ?? []} />
      <Confirmar
        aberto={!!excluindo}
        aoMudar={(a) => !a && setExcluindo(null)}
        titulo="Excluir disciplina?"
        texto={`"${excluindo?.nome ?? ''}" será excluída junto com todos os tópicos e estudos registrados nela. Isso não pode ser desfeito.`}
        textoBotao="Excluir disciplina"
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </>
  )
}
