import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

const PORT = Number(process.env.PORT || 8787)
const KEY = process.env.TRELLO_KEY
const TOKEN = process.env.TRELLO_TOKEN
const LIST_ID = process.env.TRELLO_LIST_ID
const FORM_SECRET = (process.env.FORM_SECRET || '').trim()

if (!KEY || !TOKEN || !LIST_ID) {
  console.error('Defina TRELLO_KEY, TRELLO_TOKEN e TRELLO_LIST_ID no arquivo .env')
  process.exit(1)
}

app.set('trust proxy', 1)
app.use(express.json({ limit: '32kb' }))
app.use(express.urlencoded({ extended: false, limit: '32kb' }))
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Muitas tentativas. Tente de novo em alguns minutos.' },
  }),
)
app.use(express.static(path.join(__dirname, 'public')))

function clean(text, max = 2000) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max)
}

function enc(value) {
  return encodeURIComponent(String(value ?? ''))
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/config', (_req, res) => {
  res.json({ ok: true, inviteRequired: Boolean(FORM_SECRET) })
})

app.post('/api/demanda', async (req, res) => {
  try {
    const nome = clean(req.body.nome, 120)
    const email = clean(req.body.email, 160)
    const telefone = clean(req.body.telefone, 40)
    const tipo = clean(req.body.tipo, 80)
    const demanda = clean(req.body.demanda, 4000)
    const invite = clean(req.body.invite || req.body.secret, 80)

    if (FORM_SECRET && invite !== FORM_SECRET) {
      const hint = invite
        ? 'Link de convite invalido. Confira se a URL termina com ?invite=... igual ao FORM_SECRET do Render.'
        : 'Este formulario exige link de convite. Abra a URL com ?invite=SEU_TOKEN (o mesmo valor de FORM_SECRET no Render).'
      return res.status(403).json({ ok: false, error: hint })
    }
    if (!nome || !demanda) {
      return res.status(400).json({ ok: false, error: 'Informe seu nome e a demanda.' })
    }
    if (demanda.length < 10) {
      return res.status(400).json({ ok: false, error: 'Descreva a demanda com um pouco mais de detalhe.' })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'E-mail parece invalido.' })
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
    const body = await trelloRes.text()
    if (!trelloRes.ok) {
      console.error('Trello error', trelloRes.status, body.slice(0, 500))
      if (trelloRes.status === 401 || trelloRes.status === 403) {
        return res.status(502).json({
          ok: false,
          error: 'Credenciais Trello rejeitadas. No Render, confira TRELLO_KEY e TRELLO_TOKEN.',
        })
      }
      return res.status(502).json({
        ok: false,
        error: `Nao foi possivel gravar no Trello agora (HTTP ${trelloRes.status}).`,
      })
    }

    const card = JSON.parse(body)
    return res.json({
      ok: true,
      message: 'Demanda enviada. Ela ja apareceu na caixa Demandas pendentes.',
      cardUrl: card.shortUrl || card.url || null,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Erro interno ao enviar a demanda.' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Formulario de demandas ouvindo em 0.0.0.0:${PORT}`)
})
