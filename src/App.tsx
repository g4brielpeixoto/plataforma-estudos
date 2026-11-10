import { Navigate, Outlet, RouterProvider, createHashRouter } from 'react-router'
import { Layout } from './components/Layout'
import { Carregando } from './components/ui'
import { useAuth } from './contexts/AuthContext'
import { Cadastro, ContaDesativada, EsqueciSenha, Login, RedefinirSenha } from './pages/Acesso'
import { Disciplina } from './pages/Disciplina'
import { BaralhoFlash } from './pages/BaralhoFlash'
import { Edital } from './pages/Edital'
import { Estudar } from './pages/Estudar'
import { Flashcards } from './pages/Flashcards'
import { Historico } from './pages/Historico'
import { Inicio } from './pages/Inicio'
import { Perfil } from './pages/Perfil'
import { Planner } from './pages/Planner'
import { RevisaoFlash } from './pages/RevisaoFlash'
import { Usuarios } from './pages/Usuarios'

/** Só deixa passar quem está logado e com a conta ativa */
function AreaLogada() {
  const { sessao, perfil, carregando } = useAuth()
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/login" replace />
  if (perfil === undefined) return <Carregando texto="Carregando sua conta…" />
  if (perfil === null) return <ContaDesativada semPerfil />
  if (!perfil.ativo) return <ContaDesativada />
  return <Outlet />
}

function SoMaster() {
  const { perfil } = useAuth()
  if (perfil?.papel !== 'master') return <Navigate to="/" replace />
  return <Outlet />
}

function Publica() {
  const { carregando } = useAuth()
  if (carregando) return <Carregando />
  return <Outlet />
}

const router = createHashRouter([
  {
    element: <Publica />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/cadastro', element: <Cadastro /> },
      { path: '/esqueci-senha', element: <EsqueciSenha /> },
      { path: '/redefinir-senha', element: <RedefinirSenha /> },
    ],
  },
  {
    element: <AreaLogada />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Inicio /> },
          { path: '/edital', element: <Edital /> },
          { path: '/edital/:id', element: <Disciplina /> },
          { path: '/planner', element: <Planner /> },
          { path: '/flashcards', element: <Flashcards /> },
          { path: '/flashcards/:id', element: <BaralhoFlash /> },
          { path: '/estudar', element: <Estudar /> },
          { path: '/historico', element: <Historico /> },
          { path: '/perfil', element: <Perfil /> },
          { element: <SoMaster />, children: [{ path: '/usuarios', element: <Usuarios /> }] },
        ],
      },
      // revisão em tela cheia, sem o menu
      { path: '/flashcards/estudar/:escopo', element: <RevisaoFlash /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App() {
  return <RouterProvider router={router} />
}
