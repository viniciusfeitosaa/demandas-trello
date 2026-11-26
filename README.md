# Formulário de demandas → Trello

Sua tela em `public/` + API no **Cloudflare Worker** (plano free, sem cold sleep de PaaS).

Você **não** mantém servidor. O GitHub Action publica sozinho a cada push na `main`.

## Setup único (gratuito)

### 1. Token Cloudflare
1. [dash.cloudflare.com](https://dash.cloudflare.com) → perfil → **API Tokens** → **Create Token**
2. Template **Edit Cloudflare Workers** → Create
3. Copie o token
4. Em **Workers & Pages**, anote o **Account ID** (sidebar direita)

### 2. Secrets no GitHub
Repo → **Settings** → **Secrets and variables** → **Actions** → New:

| Secret | Valor |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | token do passo 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |

### 3. Secrets Trello no Cloudflare (uma vez)
Workers & Pages → **demanda-trello** → Settings → Variables:

- `TRELLO_KEY` (Secret)
- `TRELLO_TOKEN` (Secret)

(`FORM_SECRET=2026` e `TRELLO_LIST_ID` já vão no `wrangler.toml`.)

Ou no PC (logado no wrangler):

```bash
npx wrangler secret put TRELLO_KEY
npx wrangler secret put TRELLO_TOKEN
```

### 4. Disparar deploy
- Push na `main`, ou
- Aba **Actions** → **Deploy Cloudflare (gratis)** → **Run workflow**

URL final (exemplo):

`https://demanda-trello.<conta>.workers.dev/?invite=2026`

A URL exata sai no log do Action / painel **Workers**.

## Local

```bash
cp .env.example .env
npm install
npx wrangler secret put TRELLO_KEY
npx wrangler secret put TRELLO_TOKEN
npm run dev
```

## Render / GitHub Pages

- **Render**: legado (dorme no free). Pode apagar depois do Worker no ar.
- **github.io**: só estático — **não** roda a API. Não use como link do cliente.
