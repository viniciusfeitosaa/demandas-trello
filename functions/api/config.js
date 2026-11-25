import { formSecret, json } from '../_lib/helpers.js'

export async function onRequestGet({ env }) {
  return json({ ok: true, inviteRequired: Boolean(formSecret(env)) })
}
