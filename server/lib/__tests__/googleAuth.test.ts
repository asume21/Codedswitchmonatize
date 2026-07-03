import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { findOrCreateGoogleUser, usernameFromProfile, GoogleAuthError } from '../googleAuth'
import type { IStorage } from '../../storage'

/** Minimal in-memory stand-in for the two IStorage methods the logic uses. */
function storageStub(existing: Array<{ email: string; username: string }> = []) {
  const users: any[] = existing.map((u, i) => ({ id: `u${i}`, password: 'x', ...u }))
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

  it('logs in an existing user by email without creating a duplicate', async () => {
    const { storage, users } = storageStub([{ email: 'mc@example.com', username: 'taken' }])
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
    // bcrypt hash, and no plausible password compares against it
    expect(result.user.password).toMatch(/^\$2[aby]\$/)
    expect(await bcrypt.compare('', result.user.password)).toBe(false)
  })

  it('retries with a suffixed username when the display name is taken', async () => {
    const { storage } = storageStub([{ email: 'other@example.com', username: 'mc-flow' }])
    const result = await findOrCreateGoogleUser(storage, profile())
    expect(result.created).toBe(true)
    expect(result.user.username).toMatch(/^mc-flow-[0-9a-f]{6}$/)
  })
})
