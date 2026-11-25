import { clean, enc, formSecret, json } from '../_lib/helpers.js'

export async function onRequestPost({ request, env }) {
  try {
    const KEY = env.TRELLO_KEY
    const TOKEN = env.TRELLO_TOKEN
    const LIST_ID = env.TRELLO_LIST_ID
    const FORM_SECRET = formSecret(env)

    if (!KEY || !TOKEN || !LIST_ID) {
      return json(
        {
          ok: false,
          error: 'Servidor sem TRELLO_KEY / TRELLO_TOKEN / TRELLO_LIST_ID. Configure no Cloudflare Pages.',
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
    const demanda = clean(body.demanda, 4000)
    const invite = clean(body.invite || body.secret, 80)

    if (FORM_SECRET && invite !== FORM_SECRET) {
      const hint = invite
        ? 'Link de convite invalido. Use ?invite= igual ao FORM_SECRET do site.'
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

    const title = tipo
      ? `[${tipo}] ${nome}: ${demanda.slice(0, 70)}${demanda.length > 70 ? '…' : ''}`
      : `${nome}: ${demanda.slice(0, 80)}${demanda.length > 80 ? '…' : ''}`

    const desc = [
      '**Demanda recebida pelo formulario publico**',
      '',
      `**Quem pediu:** ${nome}`,
      `**E-mail:** ${email || '(nao informado)'}`,
      `**WhatsApp / telefone:** ${telefone || '(nao informado)'}`,
      `**Tipo:** ${tipo || '(nao informado)'}`,
      `**Quando:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
      '',
      '## Pedido',
      demanda,
    ].join('\n')

    const url =
      `https://api.trello.com/1/cards?key=${enc(KEY)}&token=${enc(TOKEN)}` +
      `&idList=${enc(LIST_ID)}&name=${enc(title)}&desc=${enc(desc)}&pos=top`

    const trelloRes = await fetch(url, { method: 'POST' })
    const trelloBody = await trelloRes.text()
    if (!trelloRes.ok) {
      console.error('Trello error', trelloRes.status, trelloBody.slice(0, 500))
      if (trelloRes.status === 401 || trelloRes.status === 403) {
        return json(
          {
            ok: false,
            error: 'Credenciais Trello rejeitadas. Confira TRELLO_KEY e TRELLO_TOKEN no Cloudflare.',
          },
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
      message: 'Demanda enviada. Ela ja apareceu na caixa Demandas pendentes.',
      cardUrl: card.shortUrl || card.url || null,
    })
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'Erro interno ao enviar a demanda.' }, 500)
  }
}
