import { json } from '../_lib/helpers.js'

export async function onRequestGet() {
  return json({ ok: true })
}
