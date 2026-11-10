/*
  Preparação das imagens dos flashcards antes de enviar:
  - formatos aceitos pelo bucket: JPEG, PNG, WebP e GIF;
  - outros formatos (SVG, BMP…) e imagens grandes são redesenhadas em WebP (ou PNG/JPEG se o navegador não gerar WebP),
    com no máximo 1600 px no lado maior;
  - GIF fica como está (para não perder a animação), se couber no limite.
*/

const ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const LIMITE_BUCKET = 5 * 1024 * 1024
/** Acima disso, a imagem é reduzida */
const LIMITE_SEM_REDUZIR = 900 * 1024
const LADO_MAXIMO = 1600

export const EXTENSAO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

/** Tipo pelos primeiros bytes (os arquivos do Anki não dizem o tipo) */
export function tipoPelosBytes(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
  const inicio = new TextDecoder().decode(b.slice(0, 256)).trimStart().toLowerCase()
  if (inicio.startsWith('<svg') || (inicio.startsWith('<?xml') && inicio.includes('<svg'))) return 'image/svg+xml'
  return null
}

/** Tipo pela extensão do nome (reserva, quando os bytes não dizem) */
export function tipoPeloNome(nome: string): string | null {
  const ext = nome.toLowerCase().split('.').pop() ?? ''
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' }[ext] ?? null
}

function carregar(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não deu para abrir essa imagem.'))
    }
    img.src = url
  })
}

const gerar = (canvas: HTMLCanvasElement, tipo: string, qualidade?: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, tipo, qualidade))

/** Devolve a imagem pronta para o bucket (ou erro se o formato não abrir no navegador) */
export async function prepararImagem(original: Blob): Promise<{ blob: Blob; tipo: string }> {
  const tipo = original.type
  if (ACEITOS.includes(tipo) && (original.size <= LIMITE_SEM_REDUZIR || (tipo === 'image/gif' && original.size <= LIMITE_BUCKET))) {
    return { blob: original, tipo }
  }
  const img = await carregar(original)
  const largura = img.naturalWidth || 800
  const altura = img.naturalHeight || 600
  const escala = Math.min(1, LADO_MAXIMO / Math.max(largura, altura))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(largura * escala))
  canvas.height = Math.max(1, Math.round(altura * escala))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  for (const [t, q] of [['image/webp', 0.86], ['image/jpeg', 0.86], ['image/png', undefined]] as [string, number | undefined][]) {
    const blob = await gerar(canvas, t, q)
    // alguns navegadores devolvem PNG quando não sabem gerar o formato pedido
    if (blob && blob.type === t && blob.size <= LIMITE_BUCKET) return { blob, tipo: t }
  }
  throw new Error('A imagem é grande demais, mesmo reduzida (limite de 5 MB).')
}
