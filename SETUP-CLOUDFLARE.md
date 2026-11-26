# Cloudflare no ar (grátis, sem dormir)

Só estes passos. Ignore Render / GitHub Pages / e-mail do board por agora.

## 1. Token da API

1. Abra https://dash.cloudflare.com/profile/api-tokens  
2. **Create Token** → use o template **Edit Cloudflare Workers**  
3. Create → **copie o token** (só aparece uma vez)

## 2. Account ID

1. https://dash.cloudflare.com  
2. No menu da direita (ou overview da conta): **Account ID** → copie

## 3. Secrets no GitHub

Repo: https://github.com/viniciusfeitosaa/demandas-trello/settings/secrets/actions  

**New repository secret** (dois):

| Name | Value |
|------|--------|
| `CLOUDFLARE_API_TOKEN` | token do passo 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID do passo 2 |

## 4. Rodar o deploy

1. https://github.com/viniciusfeitosaa/demandas-trello/actions  
2. Workflow **Deploy Cloudflare (gratis)**  
3. **Run workflow** → Run  

Se ficar verde: no log aparece a URL `https://demanda-trello.….workers.dev`

## 5. Secrets do Trello no Cloudflare (uma vez)

1. dash.cloudflare.com → **Workers & Pages** → **demanda-trello**  
2. **Settings** → **Variables and Secrets**  
3. Add secret:
   - `TRELLO_KEY` = sua key  
   - `TRELLO_TOKEN` = seu token  

(`FORM_SECRET=2026` e `TRELLO_LIST_ID` já vêm no código.)

## 6. Testar

Abra:

`https://SUA-URL.workers.dev/?invite=2026`

Envie uma demanda de teste → deve aparecer em **Demandas pendentes** no Trello.

## Link oficial do cliente (quando estiver ok)

`https://SUA-URL.workers.dev/?invite=2026`
