import { useEffect, useState } from 'react'
import { iniciais } from '@/lib/foto'
import { cn } from '@/lib/utils'

/** Foto de perfil redonda; sem foto (ou se o link falhar), mostra as iniciais */
export function Avatar({
  nome,
  email,
  foto,
  tamanho = 36,
  className,
}: {
  nome?: string | null
  email?: string | null
  foto?: string | null
  tamanho?: number
  className?: string
}) {
  const [falhou, setFalhou] = useState(false)
  useEffect(() => setFalhou(false), [foto])
  const estilo = { width: tamanho, height: tamanho }

  if (foto && !falhou)
    return <img src={foto} alt="" onError={() => setFalhou(true)} className={cn('shrink-0 rounded-full object-cover ring-1 ring-linha', className)} style={estilo} />

  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full bg-nevoa font-semibold text-primaria-forte select-none dark:text-primaria', className)}
      style={{ ...estilo, fontSize: Math.round(tamanho * 0.38) }}
    >
      {iniciais(nome, email)}
    </span>
  )
}
