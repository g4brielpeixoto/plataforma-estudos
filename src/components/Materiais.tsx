import { ExternalLink, FileText, Link2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useExcluirMaterial, useSalvarMaterial } from '@/hooks/dados'
import { nomeDoMaterial, normalizarUrl, tipoMaterial, type TipoMaterial } from '@/lib/materiais'
import { cn, mensagemErro } from '@/lib/utils'
import type { Material, Topico } from '@/types'
import { Botao, Campo, Dialogo, Entrada } from './ui'

const ICONE: Record<TipoMaterial, typeof Link2> = { pdf: FileText, video: Play, documento: FileText, link: Link2 }

export function IconeMaterial({ url, className }: { url: string; className?: string }) {
  const Icone = ICONE[tipoMaterial(url)]
  return <Icone className={cn('size-3.5 shrink-0', className)} aria-hidden />
}

/** Links do tópico como etiquetas clicáveis (abrem em outra aba) */
export function ChipsMateriais({
  materiais,
  maximo = 3,
  aoVerTodos,
  origem,
  className,
}: {
  materiais: Material[]
  maximo?: number
  aoVerTodos?: () => void
  /** de onde veio o link, quando não é do próprio tópico (ex.: "do tópico 4 Licitações") */
  origem?: (m: Material) => string | undefined
  className?: string
}) {
  if (!materiais.length) return null
  const visiveis = materiais.slice(0, maximo)
  const resto = materiais.length - visiveis.length
  return (
    <span className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {visiveis.map((m) => (
        <a
          key={m.id}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${nomeDoMaterial(m)}${origem?.(m) ? ` (${origem(m)})` : ''} — abre em outra aba`}
          className="inline-flex max-w-[14rem] items-center gap-1 rounded-md bg-nevoa/70 px-1.5 py-0.5 text-xs font-medium text-primaria-forte hover:bg-nevoa dark:text-primaria"
        >
          <IconeMaterial url={m.url} />
          <span className="truncate">{nomeDoMaterial(m)}</span>
        </a>
      ))}
      {resto > 0 &&
        (aoVerTodos ? (
          <button type="button" onClick={aoVerTodos} className="rounded-md px-1 text-xs font-medium text-tinta-suave hover:text-tinta">
            +{resto}
          </button>
        ) : (
          <span className="text-xs text-tinta-suave">+{resto}</span>
        ))}
    </span>
  )
}

/** Lista, adiciona, edita e remove os links de material de um tópico */
export function MateriaisDialog({ topico, materiais, aoFechar }: { topico: Topico | null; materiais: Material[]; aoFechar: () => void }) {
  const salvar = useSalvarMaterial()
  const excluir = useExcluirMaterial()
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState('')

  const limpar = () => {
    setEditandoId(null)
    setLink('')
    setTitulo('')
    setErro('')
  }
  useEffect(() => {
    if (topico) limpar()
  }, [topico])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!topico) return
    const url = normalizarUrl(link)
    if (!url) return setErro('Cole um link completo, como https://drive.google.com/… ou https://site.com/aula.pdf.')
    try {
      await salvar.mutateAsync({ id: editandoId ?? undefined, topico_id: topico.id, titulo: titulo.trim().slice(0, 120) || null, url })
      toast.success(editandoId ? 'Material atualizado.' : 'Material adicionado.')
      limpar()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  const editar = (m: Material) => {
    setEditandoId(m.id)
    setLink(m.url)
    setTitulo(m.titulo ?? '')
    setErro('')
  }

  return (
    <Dialogo aberto={topico !== null} aoMudar={(a) => !a && aoFechar()} titulo="Materiais do tópico" descricao={topico?.nome} largura="max-w-lg">
      {materiais.length > 0 && (
        <ul className="mb-5 divide-y divide-linha/70 rounded-2xl border border-linha/70">
          {materiais.map((m) => (
            <li key={m.id} className={cn('flex items-center gap-2 py-2 pr-1.5 pl-3', editandoId === m.id && 'bg-nevoa/40')}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-1 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-nevoa text-primaria-forte dark:text-primaria">
                  <IconeMaterial url={m.url} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-tinta group-hover:text-primaria-forte dark:group-hover:text-primaria">{nomeDoMaterial(m)}</span>
                  <span className="block truncate text-xs text-tinta-suave">{m.url}</span>
                </span>
              </a>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${nomeDoMaterial(m)}`}
                title="Abrir em outra aba"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
              >
                <ExternalLink className="size-4" aria-hidden />
              </a>
              <button
                type="button"
                onClick={() => editar(m)}
                aria-label={`Editar ${nomeDoMaterial(m)}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() =>
                  excluir.mutate(m.id, {
                    onSuccess: () => {
                      toast.success('Material removido.')
                      if (editandoId === m.id) limpar()
                    },
                    onError: (e) => toast.error(mensagemErro(e)),
                  })
                }
                aria-label={`Remover ${nomeDoMaterial(m)}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-ruim-fundo hover:text-ruim"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm font-semibold text-tinta">{editandoId ? 'Editar material' : materiais.length ? 'Adicionar outro material' : 'Adicionar material'}</p>
        <Campo rotulo="Link" htmlFor="m-link" dica="PDF, texto seu, vídeo, pasta do Drive… O link abre em outra aba.">
          <Entrada id="m-link" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} autoComplete="off" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </Campo>
        <Campo rotulo="Nome (opcional)" htmlFor="m-titulo">
          <Entrada id="m-titulo" maxLength={120} placeholder="Ex.: Resumo da aula 3" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Campo>
        {erro && (
          <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {editandoId ? (
            <Botao type="button" variante="secundario" onClick={limpar}>
              Cancelar edição
            </Botao>
          ) : (
            <Botao type="button" variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
          )}
          <Botao type="submit" carregando={salvar.isPending}>
            {editandoId ? (
              'Salvar alterações'
            ) : (
              <>
                <Plus className="size-4" aria-hidden /> Adicionar
              </>
            )}
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
