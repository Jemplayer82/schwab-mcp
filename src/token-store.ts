import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'

const TOKEN_PATH = process.env.TOKEN_PATH ?? '/data/tokens.json'

export interface TokenData {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
  idToken?: string
  [key: string]: unknown
}

export async function loadTokens(): Promise<TokenData | null> {
  try {
    const raw = await readFile(TOKEN_PATH, 'utf-8')
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

export async function saveTokens(tokens: TokenData): Promise<void> {
  await mkdir(dirname(TOKEN_PATH), { recursive: true })
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8')
}

export async function hasTokens(): Promise<boolean> {
  const tokens = await loadTokens()
  return tokens !== null && Boolean(tokens.accessToken)
}
