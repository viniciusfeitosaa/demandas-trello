# Formulário de demandas → Trello

App Node (Express) que recebe pedidos e cria cards na lista **Demandas pendentes** do Kanban.

## Deploy no Render (Blueprint)

1. Suba este pasta para um repositório Git (GitHub/GitLab).
2. No [Render](https://dashboard.render.com) → **New** → **Blueprint**.
3. Conecte o repositório (ele lê `render.yaml`).
4. Quando pedir as variáveis, preencha:
   - `TRELLO_KEY` — key da API Trello
   - `TRELLO_TOKEN` — token da API
   - `FORM_SECRET` — deixe vazio **ou** um token secreto (ex.: `xK9m2pQ`) para link de convite
5. Após o deploy, use a URL do serviço (tipo `https://demanda-trello.onrender.com`).

### Link de convite (sem “código” na tela)

Se `FORM_SECRET` estiver definido, compartilhe só:

`https://SEU-APP.onrender.com/?invite=SEU_TOKEN`

O cliente não vê campo de senha — o token vai na URL. Sem o `?invite=...` certo, o envio é bloqueado.

No plano free o app “dorme” após ~15 min sem uso; o primeiro acesso pode demorar ~30–50s.

## Local

```bash
cp .env.example .env
# edite .env com key/token
npm install
npm start
```

Abra `http://127.0.0.1:8787`.
