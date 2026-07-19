import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './theme.css'
import AppShell from './AppShell.jsx'
import Order from './pages/Order.jsx'
import Cabinet from './pages/Cabinet.jsx'

const router = createBrowserRouter([
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="order" replace /> },
      { path: 'order', element: <Order /> },
      { path: 'cabinet', element: <Cabinet /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
