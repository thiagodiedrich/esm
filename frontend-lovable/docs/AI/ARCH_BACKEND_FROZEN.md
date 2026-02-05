# 🧊 Arquitetura Backend — FROZEN

Este documento define a **arquitetura definitiva do backend** do SaaS ERP.

❌ Não pode ser alterado sem decisão humana explícita  
🤖 IA deve apenas EXECUTAR, nunca DECIDIR

---

## 🎯 Objetivo do Backend

- Ser a **fonte única da verdade**
- Centralizar regras de negócio
- Controlar RBAC real
- Controlar tenancy, contexto e planos
- Expor contratos estáveis para frontend e workers

---

## 🧱 Macro Arquitetura

- API Gateway (Node.js / NestJS + Fastify)
- Control Plane (PostgreSQL)
- Data Plane (Postgres / TimescaleDB / outros)
- Workers por domínio (Python / Node.js)
- Kafka como backbone assíncrono

---

## 🔧 Stack (CONGELADA)

- Node.js
- NestJS
- Fastify Adapter
- PostgreSQL (Control Plane + ERP)
- TimescaleDB (Telemetria)
- Redis (cache / rate limit)
- Kafka (local em dev, gerenciado em prod)
- Python (workers intensivos)
- Docker / Docker Compose

---

## 🧩 Separação de Responsabilidades

### API Gateway
- Autenticação
- Autorização (RBAC real)
- Resolução de tenant
- Resolução de contexto
- Rate limit
- Contracts HTTP

### Control Plane
- Tenants
- Usuários
- RBAC
- Produtos / módulos
- Planos
- Configurações globais

### Data Plane
- Dados de domínio (ERP, Telemetria, etc)
- Escalável por banco
- Pode ser isolado por tenant

### Workers
- Processamento assíncrono
- Integrações externas
- Webhooks
- Cálculos pesados

---

## 🔒 Princípios Imutáveis

- Backend **sempre valida**
- Frontend **nunca decide**
- Workers **não expõem API pública**
- ERD é a fonte máxima da verdade
- Nada é inferido

---

## 🚫 Proibições

- Lógica de negócio no frontend
- RBAC no frontend
- Acesso direto a DB fora do gateway
- Campos fora do ERD

---
