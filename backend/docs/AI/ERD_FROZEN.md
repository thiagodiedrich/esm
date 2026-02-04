# 🧊 ERD_FROZEN.md — Database Schema (Single Source of Truth)

## 📌 Propósito

Este documento define **TODAS as entidades, campos e relações** do sistema SaaS ERP.

### Regras absolutas
- ❌ Nenhuma tabela pode ser criada fora deste documento
- ❌ Nenhum campo pode ser inventado, renomeado ou inferido
- ❌ Nenhuma relação implícita é permitida
- 🤖 IA deve **PARAR E PERGUNTAR** se algo não estiver aqui
- 📐 Em caso de conflito: **ERD vence qualquer outro documento ou código**

---

# ===============================
# CAMADA 1 — TENANCY (PLATAFORMA)
# ===============================

## tenants

Representa o **tenant SaaS** (empresa ou pessoa física).

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| name | string | |
| slug | string | único, usado por domínio/subdomínio |
| is_active | boolean | |
| default_plan_id | uuid | FK → platform_plans.id |
| created_at | timestamp | |
| updated_at | timestamp | |

---

# =================================
# CAMADA 2 — PARTNERS (PESSOAS/EMPRESAS)
# =================================

## res_partners

Entidade base para **pessoa física ou jurídica**  
(referência conceitual inspirada no Odoo).

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants.id |
| name | string | |
| email | string | |
| telephone | string | |
| type | enum | `pf` \| `pj` |
| document | string | CPF / CNPJ |
| location_address | string | |
| location_address_number | string | |
| location_address_zip | string | |
| created_at | timestamp | |
| updated_at | timestamp | |

---

# =================================
# CAMADA 3 — ORGANIZAÇÕES & WORKSPACES
# =================================

## res_organizations

Empresas / unidades dentro do tenant.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants.id |
| partner_id | uuid | FK → res_partners.id |
| name | string | |
| is_default | boolean | **Somente 1 por tenant (imutável)** |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## res_workspaces

Segmentação opcional dentro da organização.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| organization_id | uuid | FK → res_organizations.id |
| name | string | |
| is_active | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## res_organization_settings

Configurações por organização.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| organization_id | uuid | FK → res_organizations.id |
| workspace_mode | enum | `required` \| `optional` |
| remember_last_context | boolean | default = false |
| menu_cache_ttl | integer | segundos |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## res_user_last_context

Contexto salvo do usuário (opcional).

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| user_id | uuid | FK → res_users.id |
| organization_id | uuid | FK → res_organizations.id |
| workspace_id | uuid | FK → res_workspaces.id \| null |
| updated_at | timestamp | |

---

# ===============================
# CAMADA 4 — USUÁRIOS & RBAC
# ===============================

## res_users

Usuários do sistema (login).

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants.id |
| partner_id | uuid | FK → res_partners.id |
| email | string | único por tenant |
| password_hash | string | |
| is_active | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## res_roles

Roles dinâmicas e configuráveis.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants.id |
| name | string | |
| scope_type | enum | `tenant` \| `organization` \| `workspace` |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## res_permissions

Permissões atômicas do sistema.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| code | string | ex: `erp.purchase_order.approve` |
| description | string | |
| created_at | timestamp | |

---

## res_role_permissions

Vínculo entre roles e permissões.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| role_id | uuid | FK → res_roles.id |
| permission_id | uuid | FK → res_permissions.id |

---

## res_user_roles

Role atribuída ao usuário com escopo.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| user_id | uuid | FK → res_users.id |
| role_id | uuid | FK → res_roles.id |
| scope_type | enum | `tenant` \| `organization` \| `workspace` |
| scope_id | uuid | ID do escopo |
| created_at | timestamp | |

---

## res_user_permission_overrides

Overrides diretos de permissão por usuário.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| user_id | uuid | FK → res_users.id |
| permission_id | uuid | FK → res_permissions.id |
| allowed | boolean | true = grant / false = revoke |
| created_at | timestamp | |

---

# =========================================
# CAMADA 5 — PRODUTOS, MÓDULOS E PLANOS (SAAS)
# =========================================

## platform_products

Produtos SaaS (ERP, Telemetria, etc).

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| code | string | ex: `erp`, `telemetry` |
| name | string | |
| created_at | timestamp | |

---

## platform_product_modules

Módulos de cada produto.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| product_id | uuid | FK → platform_products.id |
| code | string | ex: `purchase_order` |
| name | string | |
| created_at | timestamp | |

---

## platform_plans

Planos comerciais.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| id | uuid | PK |
| code | string | ex: `free`, `pro`, `enterprise` |
| name | string | |
| created_at | timestamp | |

---

## tenant_platform_products

Produtos habilitados por tenant.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| tenant_id | uuid | FK → tenants.id |
| product_id | uuid | FK → platform_products.id |
| is_active | boolean | |

---

## tenant_platform_product_modules

Módulos habilitados por tenant.

| Campo | Tipo | Observações |
|-----|-----|-------------|
| tenant_id | uuid | FK → tenants.id |
| product_module_id | uuid | FK → platform_product_modules.id |
| is_active | boolean | |

---

# 🧊 STATUS FINAL

- ✅ ERD completo
- ✅ Congelado
- ✅ Sem campos implícitos
- ✅ Fonte máxima da verdade
- ✅ Pronto para gerar migrations SQL
- ✅ Pronto para uso por IA

---
