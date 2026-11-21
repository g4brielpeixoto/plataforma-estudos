import * as RadixDialog from '@radix-ui/react-dialog'
import { BookOpen, CalendarDays, ChevronRight, History, House, Layers, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, ScanSearch, Sun, Timer, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { MiniCronometro } from './MiniCronometro'
import { cn } from '@/lib/utils'

const itens = [
  { para: '/', rotulo: 'Início', icone: House, fim: true },
  { para: '/edital', rotulo: 'Edital', icone: BookOpen, fim: false },
  { para: '/planner', rotulo: 'Planner', icone: CalendarDays, fim: false },
  { para: '/flashcards', rotulo: 'Flashcards', icone: Layers, fim: false },
  { para: '/estudar', rotulo: 'Estudar', icone: Timer, fim: false },
  { para: '/historico', rotulo: 'Histórico', icone: History, fim: false },
  { para: '/raio-x', rotulo: 'Raio-X', icone: ScanSearch, fim: false },
]
// a barra de baixo do celular tem só os 4 atalhos mais usados; o resto fica no menu lateral (☰)
const ATALHOS_CELULAR = ['/', '/edital', '/planner', '/flashcards']
const itensCelular = itens.filter((i) => ATALHOS_CELULAR.includes(i.para))

export function useTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', escuro)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#1d171f' : '#8F7193')
  }, [escuro])
  const alternar = () => {
    setEscuro((v) => {
      try {
        localStorage.setItem('tema', v ? 'claro' : 'escuro')
      } catch {
        /* navegador sem armazenamento: o tema só não fica salvo */
      }
      return !v
    })
  }
  return { escuro, alternar }
}

export function Marca({ className }: { className?: string }) {
  return (
    <Logo className={cn('h-8', className)} />
  )
}

export function Layout() {
  const { perfil, sair } = useAuth()
  const { escuro, alternar } = useTema()
  const master = perfil?.papel === 'master'
  // o planner usa a largura toda para caberem os 7 dias lado a lado
  const todos = master ? [...itens, { para: '/usuarios', rotulo: 'Usuários', icone: Users, fim: false }] : itens
  const [recolhido, setRecolhido] = useState(() => {
    try {
      return localStorage.getItem('menu-recolhido') === '1'
    } catch {
      return false
    }
  })
  const [menuAberto, setMenuAberto] = useState(false)
  const alternarMenu = () =>
    setRecolhido((v) => {
      try {
        localStorage.setItem('menu-recolhido', v ? '0' : '1')
      } catch {
        /* sem armazenamento: só não fica salvo */
      }
      return !v
    })

  return (
    <div className="min-h-dvh lg:flex">
      {/* barra lateral (telas grandes): expandida com nomes ou recolhida só com ícones */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-linha/70 bg-superficie/70 py-6 transition-[width] duration-200 lg:flex',
          recolhido ? 'w-[76px] px-3' : 'w-60 px-4',
        )}
      >
        <div className={cn('flex items-center', recolhido ? 'flex-col gap-3' : 'justify-between gap-2 pl-2')}>
          {recolhido ? <img src="./favicon.svg" alt="Aprovi" className="size-8" /> : <Marca />}
          <button
            onClick={alternarMenu}
            aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
            title={recolhido ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!recolhido}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-nevoa/60 hover:text-tinta"
          >
            {recolhido ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
          </button>
        </div>
        <nav className={cn('flex flex-col gap-1', recolhido ? 'mt-5' : 'mt-8')} aria-label="Principal">
          {todos.map(({ para, rotulo, icone: Icone, fim }) => (
            <NavLink
              key={para}
              to={para}
              end={fim}
              title={recolhido ? rotulo : undefined}
              aria-label={recolhido ? rotulo : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-xl py-2.5 text-[15px] font-medium transition-colors',
                  recolhido ? 'justify-center px-0' : 'gap-3 px-3',
                  isActive ? 'bg-nevoa text-tinta' : 'text-tinta-suave hover:bg-nevoa/50 hover:text-tinta',
                )
              }
            >
              <Icone className="size-[18px] shrink-0" aria-hidden />
              {!recolhido && rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-linha/70 pt-4">
          <NavLink
            to="/perfil"
            title={recolhido ? 'Meu perfil' : undefined}
            aria-label={recolhido ? 'Meu perfil' : undefined}
            className={({ isActive }) =>
              cn(
                'mb-1 flex items-center rounded-xl py-2 transition-colors',
                recolhido ? 'justify-center' : 'gap-3 px-2',
                isActive ? 'bg-nevoa' : 'hover:bg-nevoa/50',
              )
            }
          >
            <Avatar nome={perfil?.nome} email={perfil?.email} foto={perfil?.foto_url} tamanho={34} />
            {!recolhido && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[15px] font-medium text-tinta">{perfil?.nome || 'Meu perfil'}</span>
                <span className="block truncate text-xs text-tinta-suave">{perfil?.email}</span>
              </span>
            )}
          </NavLink>
          <button
            onClick={alternar}
            title={recolhido ? (escuro ? 'Tema claro' : 'Tema escuro') : undefined}
            aria-label={recolhido ? (escuro ? 'Usar tema claro' : 'Usar tema escuro') : undefined}
            className={cn(
              'flex w-full items-center rounded-xl py-2 text-[15px] text-tinta-suave hover:bg-nevoa/50 hover:text-tinta',
              recolhido ? 'justify-center' : 'gap-3 px-3',
            )}
          >
            {escuro ? <Sun className="size-[18px] shrink-0" aria-hidden /> : <Moon className="size-[18px] shrink-0" aria-hidden />}
            {!recolhido && (escuro ? 'Tema claro' : 'Tema escuro')}
          </button>
          <button
            onClick={() => void sair()}
            title={recolhido ? `Sair (${perfil?.email ?? ''})` : undefined}
            aria-label={recolhido ? 'Sair' : undefined}
            className={cn(
              'flex w-full items-center rounded-xl py-2 text-[15px] text-tinta-suave hover:bg-nevoa/50 hover:text-tinta',
              recolhido ? 'justify-center' : 'gap-3 px-3',
            )}
          >
            <LogOut className="size-[18px] shrink-0" aria-hidden />
            {!recolhido && 'Sair'}
          </button>
        </div>
      </aside>

      {/* topo (celular e tablet): menu, logo e foto */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-linha/70 bg-fundo/90 py-2 pr-3 pl-2 backdrop-blur lg:hidden">
        <button
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-tinta hover:bg-nevoa/60"
        >
          <Menu className="size-6" aria-hidden />
        </button>
        <Marca />
        <NavLink
          to="/perfil"
          aria-label="Meu perfil"
          title="Meu perfil"
          className={({ isActive }) =>
            cn('ml-auto grid size-11 shrink-0 place-items-center rounded-full', isActive && 'ring-2 ring-primaria ring-inset')
          }
        >
          <Avatar nome={perfil?.nome} email={perfil?.email} foto={perfil?.foto_url} tamanho={34} />
        </NavLink>
      </header>

      <MenuCelular aberto={menuAberto} aoMudar={setMenuAberto} itens={todos} escuro={escuro} alternarTema={alternar} />

      <main className="w-full min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12 2xl:px-10">
        <Outlet />
        <MiniCronometro />
      </main>

      {/* navegação inferior (celular e tablet) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-linha/70 bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Principal"
      >
        {itensCelular.map(({ para, rotulo, icone: Icone, fim }) => (
          <NavLink
            key={para}
            to={para}
            end={fim}
            className={({ isActive }) =>
              cn('flex min-w-0 flex-col items-center gap-1 py-2.5 text-xs font-medium', isActive ? 'text-primaria' : 'text-tinta-suave')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('rounded-full px-5 py-1 transition-colors', isActive && 'bg-nevoa')}>
                  <Icone className="size-5" aria-hidden />
                </span>
                {rotulo}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Menu lateral do celular: todas as telas, perfil, tema e sair. Fecha ao escolher uma tela, ao tocar fora ou com Esc. */
function MenuCelular({
  aberto,
  aoMudar,
  itens,
  escuro,
  alternarTema,
}: {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  itens: { para: string; rotulo: string; icone: typeof House; fim: boolean }[]
  escuro: boolean
  alternarTema: () => void
}) {
  const { perfil, sair } = useAuth()
  const { pathname } = useLocation()
  // trocou de tela (inclusive pelo voltar do navegador): fecha
  useEffect(() => aoMudar(false), [pathname, aoMudar])

  const linha = 'flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors'
  return (
    <RadixDialog.Root open={aberto} onOpenChange={aoMudar}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[#2a1f2d]/45 backdrop-blur-[2px] data-[state=open]:animate-[aparecer_150ms_ease-out] lg:hidden" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col overflow-y-auto rounded-r-3xl bg-superficie px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl motion-safe:data-[state=open]:animate-[gaveta-entra_220ms_cubic-bezier(.2,.8,.2,1)] lg:hidden"
        >
          <RadixDialog.Title className="sr-only">Menu</RadixDialog.Title>
          <div className="flex items-center justify-between pr-1 pl-3">
            <Marca className="h-7" />
            <RadixDialog.Close className="grid size-11 place-items-center rounded-xl text-tinta-suave hover:bg-nevoa/60 hover:text-tinta" aria-label="Fechar menu">
              <X className="size-5" aria-hidden />
            </RadixDialog.Close>
          </div>

          <NavLink
            to="/perfil"
            onClick={() => aoMudar(false)}
            className={({ isActive }) => cn('mt-3 flex items-center gap-3 rounded-2xl p-3 transition-colors', isActive ? 'bg-nevoa' : 'bg-nevoa/45 hover:bg-nevoa/70')}
          >
            <Avatar nome={perfil?.nome} email={perfil?.email} foto={perfil?.foto_url} tamanho={44} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-semibold text-tinta">{perfil?.nome || 'Meu perfil'}</span>
              <span className="mt-0.5 block truncate text-sm text-tinta-suave">{perfil?.nome ? 'Ver perfil' : 'Adicione seu nome e sua foto'}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-tinta-suave" aria-hidden />
          </NavLink>

          <nav className="mt-4 flex flex-col gap-0.5" aria-label="Menu">
            {itens.map(({ para, rotulo, icone: Icone, fim }) => (
              <NavLink
                key={para}
                to={para}
                end={fim}
                onClick={() => aoMudar(false)}
                className={({ isActive }) => cn(linha, isActive ? 'bg-nevoa text-tinta' : 'text-tinta-suave hover:bg-nevoa/50 hover:text-tinta')}
              >
                <Icone className="size-5 shrink-0" aria-hidden />
                {rotulo}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-0.5 border-t border-linha/70 pt-3">
            <button onClick={alternarTema} className={cn(linha, 'text-tinta-suave hover:bg-nevoa/50 hover:text-tinta')}>
              {escuro ? <Sun className="size-5 shrink-0" aria-hidden /> : <Moon className="size-5 shrink-0" aria-hidden />}
              {escuro ? 'Tema claro' : 'Tema escuro'}
            </button>
            <button onClick={() => void sair()} className={cn(linha, 'text-tinta-suave hover:bg-nevoa/50 hover:text-tinta')}>
              <LogOut className="size-5 shrink-0" aria-hidden />
              Sair
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
