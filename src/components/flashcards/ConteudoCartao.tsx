import { useMemo } from 'react'
import { Check, X } from 'lucide-react'
import { compararResposta, respostaEsperada, type ParteComparada } from '@/lib/flashcards/digitar'
import { limparHtml, vazio } from '@/lib/flashcards/html'
import { frenteOmissao, versoOmissao } from '@/lib/flashcards/omissao'
import { cn } from '@/lib/utils'
import type { FlashCartao, FlashNota } from '@/types'

/**
  Lados do cartão em HTML. O conteúdo da nota é limpo de novo aqui (além de na hora de salvar),
  e só depois entram as marcas de omissão, que são geradas pelo próprio app.
*/
export function ladosDoCartao(nota: Pick<FlashNota, 'tipo' | 'frente' | 'verso'>, cartao: Pick<FlashCartao, 'ordem'>) {
  const frente = limparHtml(nota.frente)
  const verso = limparHtml(nota.verso)
  if (nota.tipo === 'omissao') {
    return {
      pergunta: frenteOmissao(frente, cartao.ordem),
      // na omissão, a resposta substitui a pergunta (o texto com o trecho revelado + o extra)
      resposta: versoOmissao(frente, cartao.ordem) + (vazio(verso) ? '' : `<hr>${verso}`),
      respostaSubstitui: true,
      digitar: false,
    }
  }
  return { pergunta: frente, resposta: verso, respostaSubstitui: false, digitar: nota.tipo === 'digitar' }
}

export function ConteudoCartao({ html, className }: { html: string; className?: string }) {
  return <div className={cn('conteudo-cartao texto-rico text-tinta', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Os dois lados prontos para exibir (memorizados) */
export function useLadosDoCartao(nota: FlashNota | undefined, cartao: FlashCartao | undefined) {
  return useMemo(() => (nota && cartao ? ladosDoCartao(nota, cartao) : null), [nota, cartao])
}

const COR_PARTE: Record<ParteComparada['tipo'], string> = {
  certo: 'bg-bom-fundo text-tinta',
  errado: 'bg-ruim-fundo text-ruim line-through decoration-1',
  faltou: 'bg-medio-fundo text-tinta underline decoration-medio decoration-2 underline-offset-4',
}

function Partes({ partes }: { partes: ParteComparada[] }) {
  return (
    <>
      {partes.map((p, i) => (
        <span key={i} className={cn('rounded-[3px] [box-decoration-break:clone]', COR_PARTE[p.tipo])}>
          {p.texto}
        </span>
      ))}
    </>
  )
}

/** Cartão "Digitar a resposta": o que a pessoa escreveu comparado com o verso, letra por letra (estilo Anki) */
export function ComparacaoDigitada({ digitada, versoHtml }: { digitada: string; versoHtml: string }) {
  const c = useMemo(() => compararResposta(digitada, respostaEsperada(versoHtml)), [digitada, versoHtml])
  return (
    <div className="mx-auto max-w-xl text-center">
      <p
        className={cn(
          'mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
          c.igual ? 'bg-bom-fundo text-bom' : c.quaseIgual ? 'bg-medio-fundo text-medio' : 'bg-ruim-fundo text-ruim',
        )}
      >
        {c.igual ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
        {c.igual ? 'Resposta certa' : c.quaseIgual ? 'Quase: só muda acento, maiúscula ou pontuação' : c.vazia ? 'Você não digitou nada' : 'Resposta diferente'}
      </p>
      {!c.igual && !c.vazia && (
        <>
          <p className="text-xs text-tinta-suave">Você digitou</p>
          <p className="conteudo-cartao mt-1 [overflow-wrap:anywhere]">
            <Partes partes={c.digitada} />
          </p>
          <p className="mt-4 text-xs text-tinta-suave">Resposta certa</p>
        </>
      )}
      <p className={cn('conteudo-cartao [overflow-wrap:anywhere]', !c.igual && !c.vazia && 'mt-1')}>
        {c.vazia ? <span>{c.esperada.map((p) => p.texto).join('')}</span> : <Partes partes={c.esperada} />}
      </p>
      {!c.igual && !c.vazia && (
        <p className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-tinta-suave">
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-bom-fundo ring-1 ring-bom/40" aria-hidden />certo</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-ruim-fundo ring-1 ring-ruim/40" aria-hidden />a mais ou trocado</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-medio-fundo ring-1 ring-medio/40" aria-hidden />faltou</span>
        </p>
      )}
    </div>
  )
}
