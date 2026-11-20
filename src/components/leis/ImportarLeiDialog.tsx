import { useEffect, useMemo, useState } from 'react'
import { analisarLinhasDeLei, type LinhaImportada } from '@/lib/leis'
import { Botao, Dialogo } from '../ui'

/** Colar uma lista de artigos: uma linha por artigo, recuo = linha de dentro, [alta]/[média]/[baixa] no fim marca a incidência */
export function ImportarLeiDialog({ aberto, aoMudar, aoImportar }: { aberto: boolean; aoMudar: (v: boolean) => void; aoImportar: (linhas: LinhaImportada[]) => void }) {
  const [texto, setTexto] = useState('')
  useEffect(() => {
    if (aberto) setTexto('')
  }, [aberto])
  const linhas = useMemo(() => analisarLinhasDeLei(texto), [texto])
  const marcadas = linhas.filter((l) => l.incidencia).length

  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo="Importar lista" descricao="Cole uma linha por artigo. As linhas entram no fim da lei." largura="max-w-2xl">
      <div className="space-y-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={11}
          autoFocus
          aria-label="Lista de artigos"
          placeholder={'Art. 7º - Direitos dos trabalhadores [alta]\n    XIII - jornada de 8h diárias e 44h semanais\n    XVI - hora extra de no mínimo 50%\nArt. 8º - Liberdade sindical [média]\nArt. 9º - Direito de greve'}
          className="w-full rounded-xl border border-linha bg-superficie px-3 py-2.5 font-mono text-sm leading-relaxed text-tinta outline-none placeholder:text-tinta-suave/60 focus:border-primaria focus:ring-2 focus:ring-primaria/40"
        />
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-tinta-suave">
          <li>Linha com recuo (espaços ou tab) fica dentro da linha de cima.</li>
          <li>
            Termine a linha com <strong className="font-semibold text-tinta">[alta]</strong>, <strong className="font-semibold text-tinta">[média]</strong> ou <strong className="font-semibold text-tinta">[baixa]</strong> para já marcar a incidência.
          </li>
        </ul>
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-sm text-tinta-suave numeros" role="status">
            {linhas.length === 0 ? 'Nada para importar ainda.' : `${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'}${marcadas ? `, ${marcadas} com incidência` : ''}.`}
          </p>
          <div className="flex gap-2">
            <Botao type="button" variante="secundario" onClick={() => aoMudar(false)}>
              Cancelar
            </Botao>
            <Botao
              type="button"
              disabled={!linhas.length}
              onClick={() => {
                aoImportar(linhas)
                aoMudar(false)
              }}
            >
              Importar
            </Botao>
          </div>
        </div>
      </div>
    </Dialogo>
  )
}
