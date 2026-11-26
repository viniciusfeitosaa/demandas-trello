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
