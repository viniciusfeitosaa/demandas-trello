import { clean, enc, formSecret, json } from './helpers.js'

const LABELS = {
  urgente: '6a89dd5616c6e5fdefbf3b55', // P0
  alta: '6a89dd57a7f0a0b4bc22c92b', // P1
  normal: '6a89dd57a929a2da9205f5cd', // P2
}

const PRIORIDADE_LABEL = {
  urgente: 'Urgente (imediato)',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
}

function parsePrazo(prazo, imediato) {
  if (imediato) {
    // Due = agora (Fortaleza), sinaliza imediato no Trello
    return new Date().toISOString()
  }
  const raw = clean(prazo, 32)
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'invalid'
  // Fim do dia em Fortaleza (UTC-3) ≈ 23:59 local
  return `${raw}T23:59:00.000-03:00`
}

async function handleDemanda(request, env) {
  const KEY = env.TRELLO_KEY
  const TOKEN = env.TRELLO_TOKEN
  const LIST_ID = env.TRELLO_LIST_ID
  const FORM_SECRET = formSecret(env)

  if (!KEY || !TOKEN || !LIST_ID) {
    return json(
      {
        ok: false,
        error: 'Faltam TRELLO_KEY / TRELLO_TOKEN / TRELLO_LIST_ID no Cloudflare.',
      },
      500,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'JSON invalido.' }, 400)
  }

  const nome = clean(body.nome, 120)
  const email = clean(body.email, 160)
  const telefone = clean(body.telefone, 40)
  const tipo = clean(body.tipo, 80)
  const prioridade = clean(body.prioridade, 20).toLowerCase() || 'normal'
  const demanda = clean(body.demanda, 4000)
  const invite = clean(body.invite || body.secret, 80)
  const imediato = prioridade === 'urgente' || body.prazo_imediato === '1' || body.prazo_imediato === true

  if (FORM_SECRET && invite !== FORM_SECRET) {
    const hint = invite
      ? 'Link de convite invalido. Use ?invite= igual ao FORM_SECRET.'
      : 'Este formulario exige link de convite. Abra com ?invite=SEU_TOKEN.'
    return json({ ok: false, error: hint }, 403)
  }
  if (!nome || !demanda) {
    return json({ ok: false, error: 'Informe seu nome e a demanda.' }, 400)
  }
  if (demanda.length < 10) {
    return json({ ok: false, error: 'Descreva a demanda com um pouco mais de detalhe.' }, 400)
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'E-mail parece invalido.' }, 400)
  }
  if (!['urgente', 'alta', 'normal', 'baixa'].includes(prioridade)) {
    return json({ ok: false, error: 'Prioridade invalida.' }, 400)
  }

  const due = parsePrazo(body.prazo, imediato)
  if (due === 'invalid') {
    return json({ ok: false, error: 'Prazo invalido. Use o seletor de data.' }, 400)
  }

  const prioTxt = PRIORIDADE_LABEL[prioridade] || prioridade
  const prefix = imediato ? '[URGENTE]' : tipo ? `[${tipo}]` : prioridade === 'alta' ? '[ALTA]' : ''
  const titleCore = `${nome}: ${demanda.slice(0, imediato || tipo || prioridade === 'alta' ? 65 : 80)}${demanda.length > 80 ? '…' : ''}`
  const title = prefix ? `${prefix} ${titleCore}` : titleCore

  const prazoTxt = imediato
    ? 'IMEDIATO'
    : due
      ? new Date(due).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
      : '(nao informado)'

  const desc = [
    '**Demanda recebida pelo formulario publico**',
    '',
    `**Quem pediu:** ${nome}`,
    `**E-mail:** ${email || '(nao informado)'}`,
    `**WhatsApp / telefone:** ${telefone || '(nao informado)'}`,
    `**Tipo:** ${tipo || '(nao informado)'}`,
    `**Prioridade:** ${prioTxt}`,
    `**Prazo:** ${prazoTxt}`,
    `**Quando:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
    '',
    '## Pedido',
    demanda,
  ].join('\n')

  let url =
    `https://api.trello.com/1/cards?key=${enc(KEY)}&token=${enc(TOKEN)}` +
    `&idList=${enc(LIST_ID)}&name=${enc(title)}&desc=${enc(desc)}&pos=top`

  if (due) url += `&due=${enc(due)}`
  const labelId = LABELS[prioridade]
  if (labelId) url += `&idLabels=${enc(labelId)}`

  const trelloRes = await fetch(url, { method: 'POST' })
  const trelloBody = await trelloRes.text()
  if (!trelloRes.ok) {
    console.error('Trello error', trelloRes.status, trelloBody.slice(0, 500))
    if (trelloRes.status === 401 || trelloRes.status === 403) {
      return json(
        { ok: false, error: 'Credenciais Trello rejeitadas. Confira TRELLO_KEY e TRELLO_TOKEN.' },
        502,
      )
    }
    return json(
      { ok: false, error: `Nao foi possivel gravar no Trello agora (HTTP ${trelloRes.status}).` },
      502,
    )
  }

  const card = JSON.parse(trelloBody)
  return json({
    ok: true,
    message: imediato
      ? 'Demanda urgente enviada. Ela ja apareceu no topo da caixa Demandas pendentes.'
      : 'Demanda enviada. Ela ja apareceu na caixa Demandas pendentes.',
    cardUrl: card.shortUrl || card.url || null,
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({ ok: true })
      }
      if (url.pathname === '/api/config' && request.method === 'GET') {
        return json({ ok: true, inviteRequired: Boolean(formSecret(env)) })
      }
      if (url.pathname === '/api/demanda' && request.method === 'POST') {
        return await handleDemanda(request, env)
      }
      if (url.pathname.startsWith('/api/')) {
        return json({ ok: false, error: 'Rota nao encontrada.' }, 404)
      }
    } catch (err) {
      console.error(err)
      return json({ ok: false, error: 'Erro interno.' }, 500)
    }

    return env.ASSETS.fetch(request)
  },
}
