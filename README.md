# Formulário de demandas → Trello

Form estático + API em **Cloudflare Pages Functions** (sem servidor ligado 24h, sem cold start de free tier).

## Deploy (Cloudflare Pages) — recomendado

1. Conta em [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Repo: `viniciusfeitosaa/demandas-trello`
4. Build settings:
   - Framework preset: **None**
   - Build command: *(vazio)* ou `npm run build`
   - Build output directory: `public`
   - **Deploy command: DEIXE VAZIO** — não use `npx wrangler deploy` (isso é de Worker e quebra o Pages)
5. **Environment variables** (Production):
   - `TRELLO_KEY` = sua key
   - `TRELLO_TOKEN` = seu token
   - `TRELLO_LIST_ID` = `6b04dde7590b0cb96af2c5b6` (opcional se já vier do `wrangler.toml`)
   - `FORM_SECRET` = `2026`
6. Deploy → URL tipo `https://demanda-trello.pages.dev`

### Link para clientes

`https://SEU-PROJETO.pages.dev/?invite=2026`

### Se o build falhar com `Missing entry-point`

Você colocou **Deploy command** = `npx wrangler deploy`. No Pages isso é errado.

1. Projeto → **Settings** → **Builds & deployments**
2. **Deploy command** → apague (vazio)
3. **Build output directory** → `public`
4. **Retry deployment**

### CLI (alternativa)

```bash
npm i
npx wrangler pages project create demanda-trello
npx wrangler pages secret put TRELLO_KEY --project-name=demanda-trello
npx wrangler pages secret put TRELLO_TOKEN --project-name=demanda-trello
npm run deploy
```

## Local

```bash
cp .env.example .env
# preencha TRELLO_KEY e TRELLO_TOKEN
npm install
npm run dev
```

`npm run dev` sobe Pages local (`wrangler pages dev`).  
`npm start` ainda sobe o Express antigo (opcional).

## Render (legado)

O `render.yaml` ficou só como histórico. Pode **apagar o serviço no Render** depois que o Pages estiver ok — free lá dorme e atrasa.
