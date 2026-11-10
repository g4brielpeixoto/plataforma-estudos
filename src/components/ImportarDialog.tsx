import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useImportar, type ItemImportacao } from '@/hooks/dados'
import { analisarEdital, analisarTopicos } from '@/lib/importacao'
import { CORES_DISCIPLINA, mensagemErro } from '@/lib/utils'
import type { Disciplina, Topico } from '@/types'
import { AreaTexto, Botao, Dialogo } from './ui'

const EXEMPLO_EDITAL = `# Direito do Trabalho
6.1 Jornada de trabalho
    Jornada de trabalho 2
6.2 Horas suplementares
6.3 Contrato a tempo parcial
6.4 Intervalos
# Direito Administrativo
1. Lei de Improbidade Administrativa
2. Licitações e contratos`

const EXEMPLO_TOPICOS = `6.1 Jornada de trabalho
    Jornada de trabalho 2
6.2 Horas suplementares
6.3 Contrato a tempo parcial
6.4 Intervalos`

/**
 * modo "edital": várias disciplinas de uma vez (linhas com # são disciplinas)
 * modo "topicos": só tópicos, dentro da disciplina informada
 */
export function ImportarDialog({
  aberto,
  aoMudar,
  modo,
  disciplina,
  disciplinas,
  topicos,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  modo: 'edital' | 'topicos'
  disciplina?: Disciplina
  disciplinas: Disciplina[]
  topicos: Topico[]
}) {
  const [texto, setTexto] = useState('')
  const importar = useImportar()

  const previa = useMemo(() => {
    if (modo === 'topicos' && disciplina) {
      const nomes = topicos.filter((t) => t.disciplina_id === disciplina.id).map((t) => t.nome)
      const r = analisarTopicos(texto, nomes)
      return { disciplinas: [{ nome: disciplina.nome, existente: disciplina, ...r }], semDisciplina: [] as string[] }
    }
    return analisarEdital(texto, disciplinas, topicos)
  }, [texto, modo, disciplina, disciplinas, topicos])

  const totalNovos = previa.disciplinas.reduce((s, d) => s + d.novos.length, 0)
  const disciplinasNovas = previa.disciplinas.filter((d) => !d.existente).length
  const podeImportar = (totalNovos > 0 || disciplinasNovas > 0) && previa.semDisciplina.length === 0

  const confirmar = async () => {
    const itens: ItemImportacao[] = previa.disciplinas.map((d) => ({
      disciplinaId: d.existente?.id ?? null,
      disciplinaNome: d.nome,
      topicos: d.novos,
    }))
    const usadas = new Set(disciplinas.map((d) => d.cor))
    const livres = CORES_DISCIPLINA.filter((c) => !usadas.has(c))
    try {
      const r = await importar.mutateAsync({ itens, topicosExistentes: topicos, coresNovas: livres.length ? livres : CORES_DISCIPLINA })
      const partes = []
      if (r.disciplinas) partes.push(r.disciplinas === 1 ? '1 disciplina' : `${r.disciplinas} disciplinas`)
      partes.push(r.topicos === 1 ? '1 tópico' : `${r.topicos} tópicos`)
      toast.success(`Importados: ${partes.join(' e ')}.`)
      setTexto('')
      aoMudar(false)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      largura="max-w-3xl"
      titulo={modo === 'edital' ? 'Importar edital completo' : `Importar tópicos em ${disciplina?.nome ?? ''}`}
      descricao={
        modo === 'edital'
          ? 'Cole o edital. Linhas que começam com # viram disciplinas; as linhas seguintes viram os tópicos dela.'
          : 'Cole a lista de tópicos, um por linha. A numeração é mantida.'
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <AreaTexto
            aria-label="Texto para importar"
            className="h-72 min-h-72 font-sans text-sm"
            placeholder={modo === 'edital' ? EXEMPLO_EDITAL : EXEMPLO_TOPICOS}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <p className="mt-2 text-sm text-tinta-suave">Comece a linha com espaços ou tab para criar um subtópico. Linhas vazias e tópicos repetidos são ignorados.</p>
        </div>

        <div className="flex flex-col rounded-2xl bg-superficie-2 p-4">
          <p className="text-sm font-semibold text-tinta">Prévia</p>
          <div className="mt-2 max-h-64 flex-1 overflow-y-auto pr-1 text-sm">
            {!texto.trim() ? (
              <p className="text-tinta-suave">A prévia aparece aqui enquanto você cola o texto.</p>
            ) : (
              <>
                {previa.semDisciplina.length > 0 && (
                  <p className="mb-3 rounded-lg bg-ruim-fundo px-2.5 py-2 text-ruim">
                    A primeira linha precisa ser uma disciplina começando com #. Há {previa.semDisciplina.length} linha(s) antes dela.
                  </p>
                )}
                <ul className="space-y-3">
                  {previa.disciplinas.map((d) => (
                    <li key={d.nome}>
                      <p className="font-semibold text-tinta">
                        {d.nome}
                        <span className="ml-2 font-normal text-tinta-suave">
                          {modo === 'edital' && (d.existente ? 'já existe, tópicos serão adicionados' : 'nova')}
                        </span>
                      </p>
                      <ul className="mt-1 space-y-0.5 border-l-2 border-lilas pl-3">
                        {d.novos.map((t) => (
                          <li key={t.nome} className={t.nivel === 1 ? 'pl-4 text-tinta-suave' : 'text-tinta'}>
                            {t.nivel === 1 && <span aria-hidden>↳ </span>}
                            {t.nome}
                          </li>
                        ))}
                        {d.repetidos.map((t) => (
                          <li key={`r-${t}`} className="text-tinta-suave line-through decoration-tinta-suave/50">
                            {t}
                          </li>
                        ))}
                        {d.novos.length === 0 && d.repetidos.length === 0 && <li className="text-tinta-suave">Sem tópicos</li>}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {texto.trim() && (
            <p className="mt-3 border-t border-linha/70 pt-3 text-sm text-tinta-suave numeros">
              {disciplinasNovas > 0 && `${disciplinasNovas} disciplina(s) nova(s) · `}
              {totalNovos} tópico(s) para importar
              {previa.disciplinas.some((d) => d.repetidos.length) && ' · riscados já existem e serão ignorados'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Botao variante="secundario" onClick={() => aoMudar(false)}>
          Cancelar
        </Botao>
        <Botao onClick={confirmar} disabled={!podeImportar} carregando={importar.isPending}>
          Importar
        </Botao>
      </div>
    </Dialogo>
  )
}
