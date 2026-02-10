# Estratégia CORS — simplificada

**Backend API ESM v1.9.0**

## Análise do problema

A implementação anterior de CORS tinha:

1. **Dois pontos de tratamento**: Fastify hook `onRequest` em `main.ts` **e** `CorsValidationMiddleware` no Nest. OPTIONS era respondido no hook; quando a requisição chegava ao middleware (em alguns ambientes/proxy), o middleware tentava responder OPTIONS de novo e falhava (`reply.header is not a function` atrás de gateway).
2. **Validação restritiva no middleware**: Para requisições que não fossem OPTIONS, o middleware **rejeitava** a requisição com `400 - Code 0: Cors Origins inválido` quando o header `Origin` não estava em `CORS_ORIGINS`. Isso bloqueava cenários válidos: ferramentas sem Origin (Postman, curl), proxy que remove Origin, ou lista desatualizada.
3. **Comportamento diferente atrás de proxy**: O objeto `reply` no middleware (Nest/Fastify atrás de Cloudflare) nem sempre tem `.header()`; o hook no Fastify recebe o reply “real”, mas mesmo assim os headers às vezes não chegavam ao browser (proxy pode alterar respostas).

Conclusão: o middleware atrapalhava mais do que ajudava e duplicava lógica já coberta pelo hook.

---

## Solução adotada

- **CORS é tratado em um único lugar na aplicação**: o hook **`onRequest`** em `main.ts`.
  - Para **todas** as requisições: são definidos os headers CORS permitidos (métodos, headers, max-age) e, se o `Origin` estiver em `CORS_ORIGINS`, também `Access-Control-Allow-Origin` e `Access-Control-Allow-Credentials`.
  - Para **OPTIONS**: a resposta é encerrada ali com status 204 (preflight).
- **Respostas de erro (4xx/5xx)** continuam com CORS graças ao **ServiceExceptionFilter**, que adiciona os mesmos headers quando o `Origin` está em `CORS_ORIGINS`.
- **CorsValidationMiddleware foi removido** da cadeia de middlewares. Não há mais validação que rejeita a requisição por Origin; o browser aplica CORS com base nos headers que enviamos (ou deixamos de enviar).

Com isso:
- Uma única lógica de CORS (hook + filter para erros).
- Nada de `reply.header is not a function` no middleware.
- Nenhum 400 “Code 0” por Origin ausente ou diferente.

---

## Se atrás de proxy os headers ainda não aparecerem

Se a API estiver atrás de **Cloudflare** (ou outro proxy) e os response headers de CORS continuarem em branco no browser:

- Configure CORS **no edge/proxy** (ex.: Cloudflare Transform Rules → Modify response header), adicionando `Access-Control-Allow-Origin` e `Access-Control-Allow-Credentials` nas respostas da API.
- Assim os headers são garantidos na borda, independentemente de como o proxy encaminha a resposta da aplicação.

---

## Variáveis

- **CORS_ORIGINS**: lista de origens permitidas separadas por vírgula (ex.: `https://easytest.simc.com.br,http://localhost:5173`). Case-insensitive. Se vazio e `NODE_ENV=production`, a API loga aviso e não adiciona CORS; em desenvolvimento pode-se usar `enableCors({ origin: true })`.
