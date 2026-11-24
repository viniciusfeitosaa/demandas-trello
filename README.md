# Formulário de demandas → Trello

App Node (Express) que recebe pedidos e cria cards na lista **Demandas pendentes** do Kanban.

## Deploy no Render (Blueprint)

1. Suba este pasta para um repositório Git (GitHub/GitLab).
2. No [Render](https://dashboard.render.com) → **New** → **Blueprint**.
3. Conecte o repositório (ele lê `render.yaml`).
4. Quando pedir as variáveis, preencha:
   - `TRELLO_KEY` — key da API Trello
   - `TRELLO_TOKEN` — token da API
   - `FORM_SECRET` — deixe vazio **ou** um código (ex.: `coop2026`) para restringir o form
5. Após o deploy, use a URL do serviço (tipo `https://demanda-trello.onrender.com`).

No plano free o app “dorme” após ~15 min sem uso; o primeiro acesso pode demorar ~30–50s.

## Local

```bash
cp .env.example .env
# edite .env com key/token
npm install
npm start
```

Abra `http://127.0.0.1:8787`.
