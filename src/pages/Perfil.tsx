import { Camera, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { Botao, CabecalhoPagina, Campo, Entrada, Painel } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useSalvarPerfil } from '@/hooks/dados'
import { prepararFoto, primeiroNome } from '@/lib/foto'
import { mensagemErro } from '@/lib/utils'

export function Perfil() {
  const { perfil, recarregarPerfil } = useAuth()
  const salvar = useSalvarPerfil()
  const seletor = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [novaFoto, setNovaFoto] = useState<Blob | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [removerFoto, setRemoverFoto] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => setNome(perfil?.nome ?? ''), [perfil?.nome])
  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa])

  if (!perfil) return null

  const fotoExibida = previa ?? (removerFoto ? null : perfil.foto_url)
  const mudou = nome.trim() !== (perfil.nome ?? '') || !!novaFoto || (removerFoto && !!perfil.foto_url)

  const escolherFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setErro('')
    setPreparando(true)
    try {
      const blob = await prepararFoto(arquivo)
      setNovaFoto(blob)
      setPrevia(URL.createObjectURL(blob))
      setRemoverFoto(false)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setPreparando(false)
    }
  }

  const tirarFoto = () => {
    setNovaFoto(null)
    setPrevia(null)
    setRemoverFoto(true)
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    const limpo = nome.trim().replace(/\s+/g, ' ')
    if (limpo.length > 80) return setErro('Use no máximo 80 caracteres no nome.')
    try {
      await salvar.mutateAsync({ userId: perfil.user_id, nome: limpo || null, novaFoto, removerFoto, fotoAtual: perfil.foto_url })
      await recarregarPerfil()
      setNovaFoto(null)
      setPrevia(null)
      setRemoverFoto(false)
      toast.success('Perfil salvo.')
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <div className="max-w-2xl">
      <CabecalhoPagina titulo="Meu perfil" subtitulo="Seu nome e sua foto aparecem na saudação e no menu." />

      <Painel className="p-5 sm:p-7">
        <form onSubmit={enviar} className="space-y-7">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <Avatar nome={nome || perfil.nome} email={perfil.email} foto={fotoExibida} tamanho={112} className="text-3xl" />
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <div className="flex flex-wrap justify-center gap-2">
                <Botao type="button" variante="secundario" onClick={() => seletor.current?.click()} carregando={preparando}>
                  <Camera className="size-4" aria-hidden /> {fotoExibida ? 'Trocar foto' : 'Escolher foto'}
                </Botao>
                {fotoExibida && (
                  <Botao type="button" variante="fantasma" onClick={tirarFoto}>
                    <Trash2 className="size-4" aria-hidden /> Remover
                  </Botao>
                )}
              </div>
              <p className="text-center text-sm text-tinta-suave sm:text-left">A foto é recortada em quadrado, a partir do centro.</p>
              <input ref={seletor} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={escolherFoto} />
            </div>
          </div>

          <Campo rotulo="Como você quer ser chamado" htmlFor="p-nome" dica={nome.trim() ? `A saudação fica: "Boa noite, ${primeiroNome(nome)}!"` : 'Aparece na saudação da página inicial.'}>
            <Entrada id="p-nome" value={nome} maxLength={80} autoComplete="name" placeholder="Ex.: Raissa Lourena" onChange={(e) => setNome(e.target.value)} />
          </Campo>

          <div>
            <p className="text-sm font-medium text-tinta">E-mail</p>
            <p className="mt-1 text-[15px] text-tinta-suave">{perfil.email}</p>
          </div>

          {erro && (
            <p role="alert" className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-sm text-ruim">
              {erro}
            </p>
          )}

          <div className="flex justify-end">
            <Botao type="submit" disabled={!mudou} carregando={salvar.isPending}>
              Salvar perfil
            </Botao>
          </div>
        </form>
      </Painel>
    </div>
  )
}
