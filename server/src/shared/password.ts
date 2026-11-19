import bcrypt from 'bcrypt'
import { AppError } from './app-error.js'

type ArgonModule = {
  argon2id: number
  hash(value: string, options: { type: number; memoryCost: number; timeCost: number; parallelism: number }): Promise<string>
  verify(hash: string, value: string): Promise<boolean>
}

let argonModule: ArgonModule | null | undefined
async function loadArgon(): Promise<ArgonModule | null> {
  if (argonModule !== undefined) return argonModule
  try {
    const moduleName = 'argon2'
    argonModule = await import(moduleName) as ArgonModule
  } catch { argonModule = null }
  return argonModule
}

export function assertStrongPassword(password: string): void {
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 10 characters and include upper-case, lower-case, and a number')
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertStrongPassword(password)
  const argon = await loadArgon()
  if (argon) return argon.hash(password, { type: argon.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 })
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const argon = await loadArgon()
  if (hash.startsWith('$argon2') && argon) return argon.verify(hash, password)
  if (hash.startsWith('$2')) return bcrypt.compare(password, hash)
  return false
}
