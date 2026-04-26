// Side-effect module: loads .env from the server directory (not cwd) so that
// provider modules' top-level env reads succeed regardless of where `node`
// is invoked from. Must be the FIRST import in server/index.js — ESM
// guarantees depth-first post-order, so this fully evaluates before any
// subsequent import in the same file.
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dir, '.env') })
