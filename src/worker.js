import {
  cardIdFromInput,
  clean,
  enc,
  formSecret,
  json,
  parseCardMeta,
  requireInvite,
} from './helpers.js'

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
  if (imediato) return new Date().toISOString()
  const raw = clean(prazo, 32)
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'invalid'
  return `${raw}T23:59:00.000-03:00`
}

async function handleDemanda(request, env) {
  const KEY = env.TRELLO_KEY
  const TOKEN = env.TRELLO_TOKEN
  const LIST_ID = env.TRELLO_LIST_ID

  if (!KEY || !TOKEN || !LIST_ID) {
    return json(
      { ok: false, error: 'Faltam TRELLO_KEY / TRELLO_TOKEN / TRELLO_LIST_ID no Cloudflare.' },
      500,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'JSON invalido.' }, 400)
  }

  const inviteGate = requireInvite(env, body.invite || body.secret)
  if (inviteGate) return inviteGate

  const nome = clean(body.nome, 120)
  const email = clean(body.email, 160)
  const telefone = clean(body.telefone, 40)
  const tipo = clean(body.tipo, 80)
  const prioridade = clean(body.prioridade, 20).toLowerCase() || 'normal'
  const demanda = clean(body.demanda, 4000)
  const avisar = body.avisar === '1' || body.avisar === true
  const imediato = prioridade === 'urgente' || body.prazo_imediato === '1' || body.prazo_imediato === true

  if (!nome || !demanda) {
    return json({ ok: false, error: 'Informe seu nome e a demanda.' }, 400)
  }
  if (demanda.length < 10) {
    return json({ ok: false, error: 'Descreva a demanda com um pouco mais de detalhe.' }, 400)
  }
  if (avisar && !email) {
    return json({ ok: false, error: 'Informe o e-mail para receber o aviso de conclusao.' }, 400)
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
    `**Aviso de conclusao:** ${avisar ? 'sim' : 'nao'}`,
    `**Quando:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
    '',
    `NOTIFY: ${avisar ? 'sim' : 'nao'}`,
    email ? `NOTIFY_EMAIL: ${email}` : '',
    '',
    '## Pedido',
    demanda,
  ]
    .filter(Boolean)
    .join('\n')

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

async function fetchCard(env, cardRef) {
  const id = cardIdFromInput(cardRef)
  if (!id) return { error: json({ ok: false, error: 'Informe o link ou ID do card Trello.' }, 400) }
  const KEY = env.TRELLO_KEY
  const TOKEN = env.TRELLO_TOKEN
  if (!KEY || !TOKEN) {
    return { error: json({ ok: false, error: 'Trello nao configurado no Worker.' }, 500) }
  }
  const res = await fetch(
    `https://api.trello.com/1/cards/${enc(id)}?key=${enc(KEY)}&token=${enc(TOKEN)}&fields=id,name,desc,shortUrl,url,due,idList`,
  )
  const text = await res.text()
  if (!res.ok) {
    return { error: json({ ok: false, error: 'Card nao encontrado no Trello.' }, 404) }
  }
  return { card: JSON.parse(text), KEY, TOKEN }
}

async function handleCardInfo(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'JSON invalido.' }, 400)
  }
  const gate = requireInvite(env, body.invite)
  if (gate) return gate

  const got = await fetchCard(env, body.card)
  if (got.error) return got.error

  const meta = parseCardMeta(got.card.desc)
  return json({
    ok: true,
    card: {
      id: got.card.id,
      name: got.card.name,
      shortUrl: got.card.shortUrl || got.card.url,
    },
    ...meta,
  })
}

function buildNotifyMail({ nome, email, cardName, cardUrl, mensagem }) {
  const assunto = `Demanda concluída: ${cardName.slice(0, 80)}`
  const corpo = [
    `Ola${nome ? ` ${nome}` : ''},`,
    '',
    'Sua demanda foi concluida.',
    '',
    `Titulo: ${cardName}`,
    cardUrl ? `Card: ${cardUrl}` : '',
    '',
    mensagem ? `Retorno:\n${mensagem}` : '',
    '',
    'Atenciosamente,',
    'Vinicius Feitosa — Servicos em TI',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim()

  const msgHtml = mensagem
    ? `<p><strong>Retorno:</strong></p><p>${mensagem.replace(/\n/g, '<br>')}</p>`
    : ''
  const html = `
    <div style="font-family:Georgia,serif;line-height:1.5;color:#1a2332">
      <p>Ola${nome ? ` ${nome}` : ''},</p>
      <p>Sua demanda foi <strong>concluida</strong>.</p>
      <p><strong>Titulo:</strong> ${cardName}</p>
      ${cardUrl ? `<p><a href="${cardUrl}">Ver referencia</a></p>` : ''}
      ${msgHtml}
      <p>Atenciosamente,<br>Vinicius Feitosa — Servicos em TI</p>
    </div>
  `.trim()

  const mailto = `mailto:${enc(email)}?subject=${enc(assunto)}&body=${enc(corpo)}`
  return { assunto, corpo, html, mailto, email }
}

async function handleNotificar(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'JSON invalido.' }, 400)
  }
  const gate = requireInvite(env, body.invite)
  if (gate) return gate

  const got = await fetchCard(env, body.card)
  if (got.error) return got.error

  const meta = parseCardMeta(got.card.desc)
  const email = clean(body.email || meta.email, 160)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(
      { ok: false, error: 'Este card nao tem e-mail valido. Informe o e-mail manualmente.' },
      400,
    )
  }

  const mensagem = clean(body.mensagem, 2000)
  const mail = buildNotifyMail({
    nome: meta.nome,
    email,
    cardName: got.card.name,
    cardUrl: got.card.shortUrl || got.card.url,
    mensagem,
  })

  let sent = false
  let sendError = null
  if (env.RESEND_API_KEY && env.NOTIFY_FROM) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: env.NOTIFY_FROM,
          to: [email],
          subject: mail.assunto,
          text: mail.corpo,
          html: mail.html,
        }),
      })
      const bodyTxt = await r.text()
      if (r.ok) sent = true
      else {
        let detail = bodyTxt.slice(0, 300)
        try {
          const j = JSON.parse(bodyTxt)
          detail = j.message || j.error || detail
        } catch {}
        sendError = `Resend HTTP ${r.status}: ${detail}`
      }
    } catch (err) {
      sendError = String(err)
    }
  }

  const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
  const comment = sent
    ? `Cliente notificado por e-mail (${email}) via Resend em ${when}.`
    : `Retorno preparado para ${email} em ${when}.${sendError ? ` Auto-envio falhou: ${sendError}` : ' Abra o mailto.'}`
  await fetch(
    `https://api.trello.com/1/cards/${enc(got.card.id)}/actions/comments?key=${enc(got.KEY)}&token=${enc(got.TOKEN)}&text=${enc(comment)}`,
    { method: 'POST' },
  )

  return json({
    ok: true,
    sent,
    sendError,
    mailto: mail.mailto,
    email,
    message: sent
      ? 'E-mail de conclusao enviado automaticamente ao cliente (Resend).'
      : sendError
        ? `Nao enviou automatico (${sendError}). Use o botao do seu e-mail.`
        : 'Pronto. Abra o e-mail no botao abaixo.',
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
        return json({
          ok: true,
          inviteRequired: Boolean(formSecret(env)),
          autoEmail: Boolean(env.RESEND_API_KEY && env.NOTIFY_FROM),
        })
      }
      if (url.pathname === '/api/demanda' && request.method === 'POST') {
        return await handleDemanda(request, env)
      }
      if (url.pathname === '/api/card-info' && request.method === 'POST') {
        return await handleCardInfo(request, env)
      }
      if (url.pathname === '/api/notificar' && request.method === 'POST') {
        return await handleNotificar(request, env)
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
