import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './theme.css'
import AppShell from './AppShell.jsx'
import Order from './pages/Order.jsx'
import Cabinet from './pages/Cabinet.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Forgot from './pages/Forgot.jsx'
import Reset from './pages/Reset.jsx'
import Verify from './pages/Verify.jsx'

const router = createBrowserRouter([
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="order" replace /> },
      { path: 'order', element: <Order /> },
      { path: 'cabinet', element: <Cabinet /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot', element: <Forgot /> },
      { path: 'reset', element: <Reset /> },
      { path: 'verify', element: <Verify /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
