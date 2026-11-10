import { useMemo } from 'react'
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
    }
  }
  return { pergunta: frente, resposta: verso, respostaSubstitui: false }
}

export function ConteudoCartao({ html, className }: { html: string; className?: string }) {
  return <div className={cn('conteudo-cartao texto-rico text-tinta', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Os dois lados prontos para exibir (memorizados) */
export function useLadosDoCartao(nota: FlashNota | undefined, cartao: FlashCartao | undefined) {
  return useMemo(() => (nota && cartao ? ladosDoCartao(nota, cartao) : null), [nota, cartao])
}
