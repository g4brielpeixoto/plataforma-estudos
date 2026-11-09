import { BookOpen, History, House, LogOut, Moon, Sun, Timer, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const itens = [
  { para: '/', rotulo: 'Início', icone: House, fim: true },
  { para: '/edital', rotulo: 'Edital', icone: BookOpen, fim: false },
  { para: '/estudar', rotulo: 'Estudar', icone: Timer, fim: false },
  { para: '/historico', rotulo: 'Histórico', icone: History, fim: false },
]

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
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src="./favicon.svg" alt="" className="size-8" />
      <span className="font-serif text-lg font-medium text-tinta">Estudos</span>
    </div>
  )
}

export function Layout() {
  const { perfil, sair } = useAuth()
  const { escuro, alternar } = useTema()
  const master = perfil?.papel === 'master'
  const todos = master ? [...itens, { para: '/usuarios', rotulo: 'Usuários', icone: Users, fim: false }] : itens

  return (
    <div className="min-h-dvh lg:flex">
      {/* barra lateral (telas grandes) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-linha/70 bg-superficie/70 px-4 py-6 lg:flex">
        <Marca className="px-2" />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Principal">
          {todos.map(({ para, rotulo, icone: Icone, fim }) => (
            <NavLink
              key={para}
              to={para}
              end={fim}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
                  isActive ? 'bg-nevoa text-tinta' : 'text-tinta-suave hover:bg-nevoa/50 hover:text-tinta',
                )
              }
            >
              <Icone className="size-[18px]" aria-hidden />
              {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-linha/70 pt-4">
          <p className="truncate px-3 pb-2 text-sm text-tinta-suave" title={perfil?.email}>
            {perfil?.email}
          </p>
          <button onClick={alternar} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[15px] text-tinta-suave hover:bg-nevoa/50 hover:text-tinta">
            {escuro ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
            {escuro ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button onClick={() => void sair()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[15px] text-tinta-suave hover:bg-nevoa/50 hover:text-tinta">
            <LogOut className="size-[18px]" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      {/* topo (celular e tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-linha/70 bg-fundo/90 px-4 py-3 backdrop-blur lg:hidden">
        <Marca />
        <div className="flex items-center gap-1">
          {master && (
            <NavLink to="/usuarios" aria-label="Usuários" className={({ isActive }) => cn('rounded-lg p-2', isActive ? 'bg-nevoa text-tinta' : 'text-tinta-suave')}>
              <Users className="size-5" />
            </NavLink>
          )}
          <button onClick={alternar} aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'} className="rounded-lg p-2 text-tinta-suave">
            {escuro ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          <button onClick={() => void sair()} aria-label="Sair" className="rounded-lg p-2 text-tinta-suave">
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        <Outlet />
      </main>

      {/* navegação inferior (celular e tablet) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-linha/70 bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Principal"
      >
        {itens.map(({ para, rotulo, icone: Icone, fim }) => (
          <NavLink
            key={para}
            to={para}
            end={fim}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 py-2.5 text-xs font-medium', isActive ? 'text-primaria' : 'text-tinta-suave')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('rounded-full px-4 py-1 transition-colors', isActive && 'bg-nevoa')}>
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
