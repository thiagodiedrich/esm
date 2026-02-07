# Deploy do frontend — Opção A (dois endereços) e B (tudo no mesmo host)

Este guia detalha **o que mudar**, **como testar** e **como resolver** para evitar o erro de MIME type (CSS/JS retornados como `application/json`) e 404 em estáticos.

---

## Resumo do problema

- O usuário acessa **https://easyapi.simc.com.br/**.
- O HTML referencia `/static/...`, `/favicon.ico`, etc. no **mesmo domínio**.
- Quem responde em `easyapi.simc.com.br` é a **API**, que devolve 404 em JSON → navegador recusa usar como CSS/JS.

**Solução**: o frontend (HTML + assets) precisa ser servido por um servidor que **entregue arquivos estáticos**, não pela API.

---

## Build do frontend (vale para as duas opções)

Sempre que for deploy, gerar o build:

```bash
cd frontend-lovable
npm ci
npm run build
```

A saída fica em **`dist/`**. O Vite gera, por exemplo:

- `dist/index.html`
- `dist/assets/*.js` e `dist/assets/*.css`
- `dist/favicon.ico` (se estiver em `public/`)

(Se o erro que você viu usa `/static/` em vez de `/assets/`, pode ser outro frontend/build; o raciocínio é o mesmo: servir a pasta de build como estáticos.)

---

# Opção A — Dois endereços (frontend e API em hosts diferentes)

**Ideia**: Frontend em um host (ex.: **easytest.simc.com.br**), API em outro (ex.: **easyapi.simc.com.br** ou **easytestapi.simc.com.br**). O usuário **nunca** abre a URL da API no browser para ver a aplicação.

## O que mudar

### 1. No projeto (`.env` do build de produção)

O frontend precisa saber **só** a URL da API. Quem serve o HTML não importa.

No **build de produção** (ou no `.env` que você usa para `npm run build`):

```env
# URL completa da API (onde o frontend fará as chamadas)
VITE_API_URL=https://easyapi.simc.com.br/api/v1
# ou, se a API estiver em outro host:
# VITE_API_URL=https://easytestapi.simc.com.br/api/v1
```

Não precisa de variável de “URL do frontend”: o frontend é servido no host onde você fizer o deploy (easytest.simc.com.br, etc.).

### 2. No servidor

- **Host do frontend** (ex.: **easytest.simc.com.br**): servidor web (Nginx, Apache, etc.) que **sirva apenas** a pasta `dist/` do frontend. Não precisa proxy para a API; o browser chama a API direto em `VITE_API_URL`.
- **Host da API** (ex.: **easyapi.simc.com.br**): continua servindo só a API. CORS deve permitir origem do frontend (ex.: `https://easytest.simc.com.br`).

## Como testar

### Teste local (simulando Opção A)

1. Build com a API de produção (ou de teste):
   ```bash
   cd frontend-lovable
   # .env com VITE_API_URL=https://easytestapi.simc.com.br/api/v1 (ou easyapi...)
   npm run build
   npm run preview
   ```
2. Abrir no browser a URL que o `preview` mostrar (ex.: `http://localhost:4173`).
3. A aplicação deve carregar (HTML + assets do próprio preview) e as chamadas devem ir para `VITE_API_URL`. Não deve aparecer erro de MIME type.

### Teste em produção (Opção A)

1. Fazer deploy do conteúdo de **`dist/`** no host do frontend (ex.: easytest.simc.com.br).
2. **Abrir no browser**: **https://easytest.simc.com.br** (ou o host que você escolheu para o frontend).
3. **Não abrir** https://easyapi.simc.com.br para “ver a aplicação”; esse endereço é só para a API.

## Como resolver (exemplo Nginx — host do frontend)

No servidor **easytest.simc.com.br** (só frontend):

```nginx
server {
    listen 443 ssl;
    server_name easytest.simc.com.br;
    root /var/www/frontend-lovable/dist;   # caminho da pasta dist/
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # SSL: ssl_certificate e ssl_certificate_key conforme seu ambiente
}
```

Não é necessário `proxy_pass` para a API: o browser usa `VITE_API_URL` (outro domínio).

---

# Opção B — Tudo no mesmo host (easyapi.simc.com.br)

**Ideia**: O **mesmo** domínio (**easyapi.simc.com.br**) serve o frontend (HTML + estáticos) e a API fica em um path (ex.: `/api/`). O servidor encaminha `/api/*` para o backend e serve o resto do build do frontend.

## O que mudar

### 1. No projeto (`.env` do build)

A API fica no **mesmo host** que o frontend, em um path:

```env
# Mesmo host, path /api/v1
VITE_API_URL=https://easyapi.simc.com.br/api/v1
```

### 2. No servidor (easyapi.simc.com.br)

- Servir a pasta **`dist/`** do frontend como raiz do site.
- Qualquer pedido para **`/api/`** (ou o path da sua API) deve ser **proxy** para o processo/serviço que roda a API (backend).
- Pedidos para `/`, `/index.html`, `/assets/*`, `/favicon.ico`, `/manifest.json`, etc. devem ser atendidos pelos arquivos estáticos (e fallback para `index.html` no caso do SPA).

## Como testar

### Teste local (simulando Opção B)

1. Servir o build localmente e apontar a API para um backend local ou para o mesmo easyapi em outro lugar:
   ```bash
   npm run build
   npm run preview
   ```
   Com `VITE_API_URL=https://easyapi.simc.com.br/api/v1` (ou um backend local), o frontend em `preview` já chama a API; o importante é que no **servidor real** o mesmo host sirva estáticos + proxy da API.

2. Em produção, depois de configurar o servidor: abrir **https://easyapi.simc.com.br** e verificar que a página carrega e que não há 404 nem MIME type errado para CSS/JS.

## Como resolver (exemplo Nginx — mesmo host)

Exemplo com API em **backend** (mesma máquina na porta 3000 ou outro serviço):

```nginx
server {
    listen 443 ssl;
    server_name easyapi.simc.com.br;

    # Raiz = build do frontend
    root /var/www/frontend-lovable/dist;
    index index.html;

    # API: encaminhar para o backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;   # ajuste porta e path
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend: SPA + estáticos
    location / {
        try_files $uri $uri/ /index.html;
    }

    # SSL conforme seu ambiente
}
```

Se a API estiver em **outra máquina**, troque `http://127.0.0.1:3000/` por `http://IP_OU_DOMINIO_BACKEND:PORTA/`.

**Importante**:  
- Tudo que **não** for `/api/` deve ser servido pelo `root` (dist) e `try_files`.  
- Assim, `/`, `/index.html`, `/assets/*`, `/favicon.ico`, `/manifest.json` vêm do frontend e não da API, e o erro de MIME type some.

---

## Checklist rápido

| Item | Opção A | Opção B |
|------|--------|--------|
| Onde o usuário abre o app | Frontend host (ex.: easytest.simc.com.br) | easyapi.simc.com.br |
| `VITE_API_URL` | URL completa da API (outro host) | https://easyapi.simc.com.br/api/v1 |
| Host do frontend | Serve só `dist/` | easyapi.simc.com.br serve `dist/` |
| API | Em outro host; CORS libera origem do frontend | Em `/api/` no mesmo host; proxy para o backend |
| Como testar | Build + preview; em produção abrir só o host do frontend | Build + configurar proxy; abrir easyapi.simc.com.br |

Se seguir uma das opções corretamente (frontend servido por um servidor que entrega estáticos e, na B, proxy da API), o erro “Refused to apply style... MIME type ('application/json')” e os 404 de estáticos são resolvidos.
