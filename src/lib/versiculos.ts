/*
  Versículos de encorajamento exibidos na página inicial.
  Texto na tradução Almeida Revista e Corrigida (tradicional).
  Para incluir mais, basta adicionar itens a esta lista.
*/

export interface Versiculo {
  texto: string
  referencia: string
}

export const VERSICULOS: Versiculo[] = [
  { referencia: 'Josué 1:9', texto: 'Não to mandei eu? Esforça-te e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor, teu Deus, é contigo por onde quer que andares.' },
  { referencia: 'Isaías 41:10', texto: 'Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus; eu te esforço, e te ajudo, e te sustento com a destra da minha justiça.' },
  { referencia: 'Filipenses 4:13', texto: 'Posso todas as coisas naquele que me fortalece.' },
  { referencia: 'Provérbios 16:3', texto: 'Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.' },
  { referencia: 'Colossenses 3:23', texto: 'E, tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens.' },
  { referencia: 'Tiago 1:5', texto: 'E, se algum de vós tem falta de sabedoria, peça-a a Deus, que a todos dá liberalmente e o não lança em rosto; e ser-lhe-á dada.' },
  { referencia: 'Isaías 40:31', texto: 'Mas os que esperam no Senhor renovarão as suas forças, subirão com asas como águias; correrão e não se cansarão; caminharão e não se fatigarão.' },
  { referencia: 'Salmos 37:5', texto: 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.' },
  { referencia: 'Provérbios 3:5-6', texto: 'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.' },
  { referencia: 'Jeremias 29:11', texto: 'Porque eu bem sei os pensamentos que penso de vós, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que esperais.' },
  { referencia: 'Romanos 8:28', texto: 'E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus, daqueles que são chamados por seu decreto.' },
  { referencia: 'Filipenses 4:6-7', texto: 'Não estejais inquietos por coisa alguma; antes, as vossas petições sejam em tudo conhecidas diante de Deus, pela oração e súplica, com ação de graças. E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos sentimentos em Cristo Jesus.' },
  { referencia: '1 Pedro 5:7', texto: 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.' },
  { referencia: 'Gálatas 6:9', texto: 'E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não houvermos desfalecido.' },
  { referencia: 'Salmos 46:1', texto: 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.' },
  { referencia: 'Deuteronômio 31:6', texto: 'Esforçai-vos e animai-vos; não temais, nem vos espanteis diante deles, porque o Senhor, teu Deus, é o que vai contigo; não te deixará, nem te desamparará.' },
  { referencia: '2 Timóteo 1:7', texto: 'Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação.' },
  { referencia: 'Salmos 121:1-2', texto: 'Elevo os olhos para os montes: de onde me virá o socorro? O meu socorro vem do Senhor, que fez o céu e a terra.' },
  { referencia: 'Provérbios 2:6', texto: 'Porque o Senhor dá a sabedoria, e da sua boca vem o conhecimento e o entendimento.' },
  { referencia: 'Salmos 32:8', texto: 'Instruir-te-ei e ensinar-te-ei o caminho que deves seguir; guiar-te-ei com os meus olhos.' },
  { referencia: 'Isaías 43:2', texto: 'Quando passares pelas águas, estarei contigo, e, quando pelos rios, eles não te submergirão; quando passares pelo fogo, não te queimarás, nem a chama arderá em ti.' },
  { referencia: 'Mateus 11:28', texto: 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.' },
  { referencia: 'João 14:27', texto: 'Deixo-vos a paz, a minha paz vos dou; não vo-la dou como o mundo a dá. Não se turbe o vosso coração, nem se atemorize.' },
  { referencia: 'Hebreus 12:1', texto: 'Portanto, nós também, pois que estamos rodeados de uma tão grande nuvem de testemunhas, deixemos todo embaraço e o pecado que tão de perto nos rodeia e corramos, com paciência, a carreira que nos está proposta.' },
  { referencia: 'Salmos 23:1', texto: 'O Senhor é o meu pastor; nada me faltará.' },
  { referencia: 'Lamentações 3:22-23', texto: 'As misericórdias do Senhor são a causa de não sermos consumidos, porque as suas misericórdias não têm fim. Novas são cada manhã; grande é a tua fidelidade.' },
  { referencia: 'Salmos 27:1', texto: 'O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; de quem me recearei?' },
  { referencia: 'Romanos 12:12', texto: 'Alegrai-vos na esperança, sede pacientes na tribulação, perseverai na oração.' },
  { referencia: '1 Coríntios 15:58', texto: 'Portanto, meus amados irmãos, sede firmes e constantes, sempre abundantes na obra do Senhor, sabendo que o vosso trabalho não é vão no Senhor.' },
  { referencia: 'Provérbios 4:7', texto: 'A sabedoria é a coisa principal; adquire, pois, a sabedoria; sim, com tudo o que possuis, adquire o conhecimento.' },
  { referencia: 'Salmos 90:12', texto: 'Ensina-nos a contar os nossos dias, de tal maneira que alcancemos coração sábio.' },
  { referencia: 'Eclesiastes 9:10', texto: 'Tudo quanto te vier à mão para fazer, faze-o conforme as tuas forças.' },
  { referencia: 'Provérbios 13:4', texto: 'A alma do preguiçoso deseja e coisa nenhuma alcança, mas a alma dos diligentes se farta.' },
  { referencia: 'Isaías 26:3', texto: 'Tu conservarás em paz aquele cuja mente está firme em ti; porque ele confia em ti.' },
  { referencia: 'Salmos 55:22', texto: 'Lança o teu cuidado sobre o Senhor, e ele te susterá; não permitirá jamais que o justo seja abalado.' },
  { referencia: 'Sofonias 3:17', texto: 'O Senhor, teu Deus, está no meio de ti, poderoso para te salvar; ele se deleitará em ti com alegria; calar-se-á por seu amor, regozijar-se-á em ti com júbilo.' },
  { referencia: '2 Coríntios 12:9', texto: 'A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza.' },
  { referencia: 'Salmos 118:24', texto: 'Este é o dia que fez o Senhor; regozijemo-nos e alegremo-nos nele.' },
  { referencia: 'Neemias 8:10', texto: 'Não vos entristeçais, porque a alegria do Senhor é a vossa força.' },
  { referencia: 'Êxodo 14:14', texto: 'O Senhor pelejará por vós, e vos calareis.' },
  { referencia: 'Salmos 34:4', texto: 'Busquei ao Senhor, e ele me respondeu; livrou-me de todos os meus temores.' },
  { referencia: 'Josué 1:8', texto: 'Não se aparte da tua boca o livro desta Lei; antes, medita nele dia e noite, para que tenhas cuidado de fazer conforme tudo quanto nele está escrito; porque, então, farás prosperar o teu caminho e, então, prudentemente te conduzirás.' },
  { referencia: 'Habacuque 2:3', texto: 'Porque a visão é ainda para o tempo determinado, e até ao fim falará, e não mentirá; se tardar, espera-o, porque certamente virá, não tardará.' },
  { referencia: 'Mateus 6:34', texto: 'Não vos inquieteis, pois, pelo dia de amanhã, porque o dia de amanhã cuidará de si mesmo. Basta a cada dia o seu mal.' },
  { referencia: 'Romanos 8:31', texto: 'Que diremos, pois, a estas coisas? Se Deus é por nós, quem será contra nós?' },
  { referencia: 'Salmos 16:8', texto: 'Tenho posto o Senhor continuamente diante de mim; por isso que ele está à minha mão direita, nunca vacilarei.' },
  { referencia: 'Provérbios 24:16', texto: 'Porque sete vezes cairá o justo e se levantará.' },
  { referencia: 'Isaías 41:13', texto: 'Porque eu, o Senhor, teu Deus, te tomo pela tua mão direita e te digo: não temas, que eu te ajudo.' },
  { referencia: 'Daniel 1:17', texto: 'Quanto a estes quatro jovens, Deus lhes deu o conhecimento e a inteligência em todas as letras e sabedoria.' },
  { referencia: 'Salmos 138:8', texto: 'O Senhor aperfeiçoará o que me diz respeito.' },
  { referencia: 'Filipenses 1:6', texto: 'Tendo por certo isto mesmo: que aquele que em vós começou a boa obra a aperfeiçoará até ao Dia de Jesus Cristo.' },
  { referencia: '1 Coríntios 10:31', texto: 'Portanto, quer comais, quer bebais ou façais outra qualquer coisa, fazei tudo para glória de Deus.' },
  { referencia: 'Hebreus 10:35-36', texto: 'Não rejeiteis, pois, a vossa confiança, que tem grande e avultado galardão. Porque necessitais de paciência, para que, depois de haverdes feito a vontade de Deus, possais alcançar a promessa.' },
  { referencia: 'Salmos 20:4', texto: 'Conceda-te conforme o teu coração e cumpra todo o teu desígnio.' },
  { referencia: 'Marcos 9:23', texto: 'Tudo é possível ao que crê.' },
  { referencia: 'Provérbios 16:9', texto: 'O coração do homem considera o seu caminho, mas o Senhor lhe dirige os passos.' },
  { referencia: 'Salmos 37:4', texto: 'Deleita-te também no Senhor, e ele te concederá o que deseja o teu coração.' },
  { referencia: '2 Crônicas 15:7', texto: 'Mas esforçai-vos, e não desfaleçam as vossas mãos; porque a vossa obra tem uma recompensa.' },
  { referencia: 'Salmos 139:14', texto: 'Eu te louvarei, porque de um modo terrível e tão maravilhoso fui formado; maravilhosas são as tuas obras, e a minha alma o sabe muito bem.' },
  { referencia: 'Isaías 30:15', texto: 'Em vos converterdes e em repousardes, estaria a vossa salvação; no sossego e na confiança, estaria a vossa força.' },
]

/** Data de hoje no horário de Brasília (yyyy-mm-dd), seja qual for o fuso do aparelho */
export function dataBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

/** O mesmo versículo o dia inteiro, para todos; muda à meia-noite de Brasília */
export function indiceDoDia(agora = new Date()): number {
  const dias = Math.floor(Date.parse(`${dataBrasilia(agora)}T00:00:00Z`) / 86_400_000)
  const n = VERSICULOS.length
  return (((dias * 7) % n) + n) % n
}
