import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@/lib/types'

const login = vi.fn()
const verify = vi.fn()

vi.mock('@/api', () => {
  class ApiError extends Error {
    status: number
    fieldErrors: Record<string, string>
    constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) { super(message); this.status = status; this.fieldErrors = fieldErrors }
  }
  return { api: { login: (...a: unknown[]) => login(...a), verifyTwoFactor: (...a: unknown[]) => verify(...a) }, ApiError, API_CONFIGURED: true, NOT_CONFIGURED_MESSAGE: '' }
})

import { ApiError } from '@/api'
import Login from './Login'
import { useAuth } from '@/store/auth'

const session = (role: Session['user']['role']): Session => ({ token: 't', user: { id: 'u', name: 'U', email: 'u@x.test', role, tenantId: role === 'super_admin' ? null : 'app_a' } })

function renderLogin(kind: 'platform' | 'business') {
  return render(
    <MemoryRouter initialEntries={[kind === 'platform' ? '/platform/login' : '/login']}>
      <Routes>
        <Route path="/login" element={<Login kind="business" />} />
        <Route path="/platform/login" element={<Login kind="platform" />} />
        <Route path="/" element={<div>BUSINESS HOME</div>} />
        <Route path="/platform" element={<div>PLATFORM HOME</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

beforeEach(() => { login.mockReset(); verify.mockReset() })
afterEach(() => { cleanup(); useAuth.getState().logout(); sessionStorage.clear() })

describe('the two sign-ins', () => {
  it('say who they are for', () => {
    renderLogin('platform')
    expect(screen.getByText('Platform owner sign-in')).toBeTruthy()
    cleanup()
    renderLogin('business')
    expect(screen.getByText('Business admin sign-in')).toBeTruthy()
  })

  it('the platform owner signs in on the platform page and lands on the platform overview', async () => {
    login.mockResolvedValue(session('super_admin'))
    renderLogin('platform')
    fill('o@x.test', 'a-long-password')
    await waitFor(() => expect(screen.getByText('PLATFORM HOME')).toBeTruthy())
    expect(useAuth.getState().session?.user.role).toBe('super_admin')
  })

  it('a business admin is refused on the platform page, with a link to theirs, and no session is kept', async () => {
    login.mockResolvedValue(session('client_admin'))
    renderLogin('platform')
    fill('b@x.test', 'a-long-password')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/platform owner only/))
    expect(screen.getByRole('link', { name: '/login' })).toBeTruthy()
    expect(useAuth.getState().session).toBeNull()
  })

  it('the platform owner is refused on the business page, with a link to theirs', async () => {
    login.mockResolvedValue(session('super_admin'))
    renderLogin('business')
    fill('o@x.test', 'a-long-password')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/business accounts only/))
    expect(screen.getByRole('link', { name: '/platform/login' })).toBeTruthy()
    expect(useAuth.getState().session).toBeNull()
  })

  it('a wrong password shows the server message and keeps the form', async () => {
    login.mockRejectedValue(new ApiError('Invalid email or password', 401))
    renderLogin('business')
    fill('b@x.test', 'nope')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Invalid email or password'))
    expect(useAuth.getState().session).toBeNull()
  })
})

describe('two-step verification at sign-in', () => {
  it('asks for the code after the password and only then gives a session', async () => {
    login.mockResolvedValue({ twoFactorRequired: true, challenge: 'chal' })
    verify.mockResolvedValue(session('super_admin'))
    renderLogin('platform')
    fill('o@x.test', 'a-long-password')
    await waitFor(() => expect(screen.getByLabelText(/^Code/)).toBeTruthy())
    expect(useAuth.getState().session).toBeNull()
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: '123 456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(screen.getByText('PLATFORM HOME')).toBeTruthy())
    expect(verify).toHaveBeenCalledWith('chal', { code: '123456' })
  })

  it('a wrong code keeps the code step; a recovery code goes through the recovery field', async () => {
    login.mockResolvedValue({ twoFactorRequired: true, challenge: 'chal' })
    verify.mockRejectedValueOnce(new ApiError('That code is not right. Check the code in your authenticator app and try again.', 401))
    renderLogin('platform')
    fill('o@x.test', 'a-long-password')
    await waitFor(() => screen.getByLabelText(/^Code/))
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not right/))
    expect(screen.getByLabelText(/^Code/)).toBeTruthy()
    verify.mockResolvedValueOnce(session('super_admin'))
    fireEvent.click(screen.getByRole('button', { name: 'Use a recovery code' }))
    fireEvent.change(screen.getByLabelText(/^Recovery code/), { target: { value: 'abcde-12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(screen.getByText('PLATFORM HOME')).toBeTruthy())
    expect(verify).toHaveBeenLastCalledWith('chal', { recoveryCode: 'abcde-12345' })
  })

  it('an expired sign-in sends the person back to the password step', async () => {
    login.mockResolvedValue({ twoFactorRequired: true, challenge: 'chal' })
    verify.mockRejectedValue(new ApiError('This sign-in expired. Start again.', 401))
    renderLogin('business')
    fill('b@x.test', 'a-long-password')
    await waitFor(() => screen.getByLabelText(/^Code/))
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(screen.getByLabelText(/^Password/)).toBeTruthy())
  })
})
