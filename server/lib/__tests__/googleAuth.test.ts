import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { findOrCreateGoogleUser, isGoogleManagedPassword, usernameFromProfile, GoogleAuthError } from '../googleAuth'
import type { IStorage } from '../../storage'

/** Minimal in-memory stand-in for the two IStorage methods the logic uses. */
function storageStub(existing: Array<{ email: string; username: string; password?: string }> = []) {
  const users: any[] = existing.map((u, i) => ({ id: `u${i}`, password: 'local-password-hash', ...u }))
  const stub = {
    getUserByEmail: async (email: string) => users.find(u => u.email === email),
    createUser: async (insert: any) => {
      if (users.some(u => u.username === insert.username)) {
        throw new Error('duplicate key value violates unique constraint "users_username_unique"')
      }
      const user = { id: `u${users.length}`, ...insert }
      users.push(user)
      return user
    },
  }
  return { storage: stub as unknown as IStorage, users }
}

const profile = (over = {}) => ({
  email: 'mc@example.com',
  emailVerified: true,
  name: 'MC Flow',
  ...over,
})

describe('usernameFromProfile', () => {
  it('slugs the Google display name', () => {
    expect(usernameFromProfile(profile())).toBe('mc-flow')
  })

  it('falls back to the email local part when the name is too short or empty', () => {
    expect(usernameFromProfile(profile({ name: '' }))).toBe('mc')
    expect(usernameFromProfile(profile({ name: '李' }))).toBe('mc')
  })
})

describe('findOrCreateGoogleUser', () => {
  it('rejects unverified emails with a 403', async () => {
    const { storage } = storageStub()
    await expect(findOrCreateGoogleUser(storage, profile({ emailVerified: false })))
      .rejects.toThrow(GoogleAuthError)
    await expect(findOrCreateGoogleUser(storage, profile({ emailVerified: false })))
      .rejects.toMatchObject({ status: 403 })
  })

  it('rejects an existing password account instead of auto-linking by email', async () => {
    const { storage, users } = storageStub([{ email: 'mc@example.com', username: 'taken' }])
    await expect(findOrCreateGoogleUser(storage, profile()))
      .rejects.toMatchObject({ status: 409 })
    expect(users).toHaveLength(1)
  })

  it('logs in an existing Google-managed user without creating a duplicate', async () => {
    const { storage, users } = storageStub([{
      email: 'mc@example.com',
      username: 'taken',
      password: 'google-oauth2:$2a$10$placeholder',
    }])
    const result = await findOrCreateGoogleUser(storage, profile())
    expect(result.created).toBe(false)
    expect(result.user.username).toBe('taken')
    expect(users).toHaveLength(1)
  })

  it('creates a new user with an unusable (hashed, random) password', async () => {
    const { storage } = storageStub()
    const result = await findOrCreateGoogleUser(storage, profile())
    expect(result.created).toBe(true)
    expect(result.user.username).toBe('mc-flow')
    // Marked Google-only password, backed by a bcrypt hash for entropy.
    expect(isGoogleManagedPassword(result.user.password)).toBe(true)
    expect(result.user.password).toMatch(/^google-oauth2:\$2[aby]\$/)
    expect(await bcrypt.compare('', result.user.password.replace(/^google-oauth2:/, ''))).toBe(false)
  })

  it('retries with a suffixed username when the display name is taken', async () => {
    const { storage } = storageStub([{ email: 'other@example.com', username: 'mc-flow' }])
    const result = await findOrCreateGoogleUser(storage, profile())
    expect(result.created).toBe(true)
    expect(result.user.username).toMatch(/^mc-flow-[0-9a-f]{6}$/)
  })
})
