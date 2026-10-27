import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SosItem, Role } from '@/lib/types'

let role: Role = 'support'
let items: SosItem[] = []

vi.mock('@/lib/useScope', () => ({ useScope: () => ({ user: { id: 'u1', name: 'Staff', email: 'staff@x.test', role, tenantId: 't1' }, tenantId: 't1', isSuper: false }) }))
vi.mock('@/api/hooks', () => ({ useSos: (status: string) => ({ data: { items: status === 'open' ? items.filter((i) => i.status !== 'RESOLVED') : items.filter((i) => i.status === 'RESOLVED'), open: items.filter((i) => i.status !== 'RESOLVED').length, unacknowledged: items.filter((i) => i.status === 'OPEN').length }, isLoading: false }) }))
vi.mock('@/components/feedback', () => ({ useToast: () => ({ success: () => {}, error: () => {} }) }))

import SosPanel from './SosPanel'

const sos = (over: Partial<SosItem> = {}): SosItem => ({
  id: 'sos_1', tripId: 'T1', status: 'OPEN', presses: 1, tripStatus: 'ON_GOING',
  raisedBy: { role: 'rider', name: 'Asha Rider', phone: '+919800000001' }, other: { name: 'Ravi Driver', phone: '+919800000002' },
  vehicle: 'UP16TS4321 · Maruti Dzire', pickup: 'Sector 62, Noida', drop: 'Connaught Place',
  locations: [{ lat: 28.58, lng: 77.34, accuracy: 9, at: '2026-10-27T12:00:00Z' }], mapUrl: 'https://www.google.com/maps?q=28.58,77.34',
  createdAt: new Date().toISOString(), lastPressAt: new Date().toISOString(), acknowledgedBy: null, acknowledgedAt: null, resolvedBy: null, resolvedAt: null, resolution: null, ...over,
})

const show = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><SosPanel /></MemoryRouter></QueryClientProvider>)
afterEach(() => { cleanup(); role = 'support'; items = [] })

describe('SosPanel', () => {
  it('shows nothing at all to a role that may not manage support (it carries phone numbers and locations)', () => {
    role = 'finance'; items = [sos()]
    const { container } = show()
    expect(container.textContent).toBe('')
  })

  it('says plainly when nothing is open', () => {
    show()
    expect(screen.getByText(/No open emergencies/)).toBeTruthy()
  })

  it('shows an open emergency with who, the other person, the vehicle, the map and the actions', () => {
    items = [sos()]
    show()
    expect(screen.getByRole('alert').textContent).toContain('1 emergency need attention')
    expect(screen.getByText(/Rider Asha Rider pressed Emergency/)).toBeTruthy()
    expect(screen.getByText('Ravi Driver')).toBeTruthy()
    expect(screen.getByText('UP16TS4321 · Maruti Dzire')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Last location on the map/ }).getAttribute('href')).toContain('28.58,77.34')
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the trip' }).getAttribute('href')).toBe('/trips/T1')
  })

  it('an acknowledged emergency offers Resolve but not Acknowledge again, and a repeat press is called out', () => {
    items = [sos({ status: 'ACKNOWLEDGED', acknowledgedBy: { email: 'staff@x.test' }, presses: 3 })]
    show()
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeTruthy()
    expect(screen.getByText('pressed 3 times')).toBeTruthy()
    expect(screen.getByText(/Acknowledged by staff@x.test/)).toBeTruthy()
  })

  it('says so when no location was shared', () => {
    items = [sos({ locations: [], mapUrl: null })]
    show()
    expect(screen.getByText('No location was shared')).toBeTruthy()
  })

  it('a driver\'s emergency names the driver as the one who raised it', () => {
    items = [sos({ raisedBy: { role: 'driver', name: 'Ravi Driver', phone: '+919800000002' }, other: { name: 'Asha Rider', phone: '+919800000001' } })]
    show()
    expect(screen.getByText(/Driver Ravi Driver pressed Emergency/)).toBeTruthy()
  })
})
