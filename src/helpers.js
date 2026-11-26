export function clean(text, max = 2000) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max)
}

export function enc(value) {
  return encodeURIComponent(String(value ?? ''))
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function formSecret(env) {
  return String(env.FORM_SECRET || '').trim()
}

export function requireInvite(env, invite) {
  const secret = formSecret(env)
  if (!secret) return null
  if (clean(invite, 80) !== secret) {
    return json(
      {
        ok: false,
        error: invite
          ? 'Link de convite invalido.'
          : 'Este recurso exige ?invite= igual ao FORM_SECRET.',
      },
      403,
    )
  }
  return null
}

export function parseCardMeta(desc) {
  const text = String(desc || '')
  const email =
    (text.match(/\*\*E-mail:\*\*\s*([^\n*]+)/i) || [])[1]?.trim() ||
    (text.match(/NOTIFY_EMAIL:\s*([^\s\n]+)/i) || [])[1]?.trim() ||
    ''
  const nome =
    (text.match(/\*\*Quem pediu:\*\*\s*([^\n*]+)/i) || [])[1]?.trim() || ''
  const telefone =
    (text.match(/\*\*WhatsApp \/ telefone:\*\*\s*([^\n*]+)/i) || [])[1]?.trim() ||
    ''
  const avisar =
    /NOTIFY:\s*sim/i.test(text) ||
    /\*\*Aviso de conclusao:\*\*\s*sim/i.test(text)
  const pedidoMatch = text.split(/## Pedido\s*/i)
  const pedido = (pedidoMatch[1] || '').trim()
  return {
    email: email && email !== '(nao informado)' ? email : '',
    nome: nome || '',
    telefone: telefone && telefone !== '(nao informado)' ? telefone : '',
    avisar,
    pedido,
  }
}

export function cardIdFromInput(raw) {
  const s = clean(raw, 200)
  if (!s) return null
  const fromUrl = s.match(/trello\.com\/c\/([a-zA-Z0-9]+)/)
  if (fromUrl) return fromUrl[1]
  if (/^[a-zA-Z0-9]{6,12}$/.test(s)) return s
  if (/^[a-f0-9]{24}$/i.test(s)) return s
  return null
}
