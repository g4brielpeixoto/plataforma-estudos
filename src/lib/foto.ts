/** Lado da foto de perfil salva (quadrada) */
const TAMANHO = 320

/** Recorta a imagem no centro em formato quadrado e reduz para 320×320 em JPEG, antes de enviar */
export async function prepararFoto(arquivo: File): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WebP).')
  let imagem: ImageBitmap
  try {
    imagem = await createImageBitmap(arquivo)
  } catch {
    throw new Error('Não foi possível ler essa imagem. Tente uma foto em JPG ou PNG.')
  }
  const lado = Math.min(imagem.width, imagem.height)
  const canvas = document.createElement('canvas')
  canvas.width = TAMANHO
  canvas.height = TAMANHO
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, TAMANHO, TAMANHO)
  imagem.close()
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88))
  if (!blob) throw new Error('Seu navegador não conseguiu processar a imagem.')
  return blob
}

/** Caminho do arquivo no armazenamento a partir do link público da foto */
export function caminhoDaFoto(url: string): string | null {
  const marca = '/object/public/avatares/'
  const i = url.indexOf(marca)
  return i < 0 ? null : decodeURIComponent(url.slice(i + marca.length).split('?')[0])
}

/** Primeiro nome para a saudação */
export function primeiroNome(nome: string | null | undefined): string | null {
  const n = nome?.trim().split(/\s+/)[0]
  return n ? n : null
}

/** Iniciais para quando não há foto: "Raissa Lourena" → "RL"; sem nome, a 1ª letra do e-mail */
export function iniciais(nome: string | null | undefined, email: string | null | undefined): string {
  const partes = nome?.trim().split(/\s+/).filter(Boolean) ?? []
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (email?.[0] ?? '?').toUpperCase()
}
