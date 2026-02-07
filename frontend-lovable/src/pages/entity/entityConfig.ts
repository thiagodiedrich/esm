/**
 * Configuração de entidades para listagem e formulário.
 * Mapeia segmentos de rota (users, organizations, ...) para API e colunas/campos.
 */

import type { ReactNode } from 'react';
import { adminApi, tenantApi } from '@/api/endpoints';

export type ColumnDef = {
  key: string;
  label: string;
  /** Se não informado, usa row[key]. */
  render?: (row: Record<string, unknown>) => ReactNode;
};

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'checkbox';
  required?: boolean;
  placeholder?: string;
};

export type EntityConfig = {
  title: string;
  titleNew: string;
  basePath: string;
  idKey: string;
  listApi: () => Promise<{ items: unknown[] }>;
  getApi: (id: string) => Promise<Record<string, unknown>>;
  createApi: (data: Record<string, unknown>) => Promise<unknown>;
  updateApi: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  deleteApi?: (id: string) => Promise<unknown>;
  columns: ColumnDef[];
  fields: FieldDef[];
};

const tenantUsersConfig: EntityConfig = {
  title: 'Usuários',
  titleNew: 'Novo usuário',
  basePath: '/tenant/users',
  idKey: 'id',
  listApi: tenantApi.users.list,
  getApi: tenantApi.users.get,
  createApi: (d) => tenantApi.users.create(d as Parameters<typeof tenantApi.users.create>[0]),
  updateApi: (id, d) => tenantApi.users.update(id, d as Parameters<typeof tenantApi.users.update>[1]),
  deleteApi: tenantApi.users.delete,
  columns: [
    { key: 'email', label: 'E-mail' },
    { key: 'is_active', label: 'Ativo', render: (r) => (r.is_active ? 'Sim' : 'Não') },
  ],
  fields: [
    { key: 'email', label: 'E-mail', type: 'email', required: true },
    { key: 'password', label: 'Senha', type: 'password', placeholder: 'Obrigatório ao criar' },
    { key: 'name', label: 'Nome do contato', type: 'text', placeholder: 'Nome exibido (opcional)' },
  ],
};

const tenantOrganizationsConfig: EntityConfig = {
  title: 'Empresas',
  titleNew: 'Nova empresa',
  basePath: '/tenant/organizations',
  idKey: 'id',
  listApi: tenantApi.organizations.list,
  getApi: async (id) => {
    const list = await tenantApi.organizations.list();
    const arr = Array.isArray(list) ? list : (list as { items?: unknown[] }).items ?? [];
    const item = (arr as Record<string, unknown>[]).find((i) => i.id === id);
    return item ?? { id, name: '' };
  },
  createApi: (d) => tenantApi.organizations.create(d),
  updateApi: (id, d) => tenantApi.organizations.update(id, d),
  deleteApi: tenantApi.organizations.delete,
  columns: [
    { key: 'name', label: 'Nome' },
  ],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
  ],
};

const tenantWorkspacesConfig: EntityConfig = {
  title: 'Workspaces',
  titleNew: 'Novo workspace',
  basePath: '/tenant/workspaces',
  idKey: 'id',
  listApi: tenantApi.workspaces.list,
  getApi: async (id) => {
    const list = await tenantApi.workspaces.list();
    const arr = Array.isArray(list) ? list : (list as { items?: unknown[] }).items ?? [];
    const item = (arr as Record<string, unknown>[]).find((i) => i.id === id);
    return item ?? { id, name: '' };
  },
  createApi: (d) => tenantApi.workspaces.create(d),
  updateApi: (id, d) => tenantApi.workspaces.update(id, d),
  deleteApi: tenantApi.workspaces.delete,
  columns: [
    { key: 'name', label: 'Nome' },
  ],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
  ],
};

const tenantPartnersConfig: EntityConfig = {
  title: 'Contatos',
  titleNew: 'Novo contato',
  basePath: '/tenant/partners',
  idKey: 'id',
  listApi: () => tenantApi.partners.list(),
  getApi: tenantApi.partners.get,
  createApi: (d) => tenantApi.partners.create(d),
  updateApi: (id, d) => tenantApi.partners.update(id, d),
  deleteApi: tenantApi.partners.delete,
  columns: [
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
  ],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
    { key: 'email', label: 'E-mail', type: 'email', required: true },
  ],
};

const tenantRolesConfig: EntityConfig = {
  title: 'Regras de acesso',
  titleNew: 'Nova regra',
  basePath: '/tenant/roles',
  idKey: 'id',
  listApi: tenantApi.roles.list,
  getApi: tenantApi.roles.get,
  createApi: (d) => tenantApi.roles.create(d),
  updateApi: (id, d) => tenantApi.roles.update(id, d),
  deleteApi: tenantApi.roles.delete,
  columns: [
    { key: 'name', label: 'Nome' },
    { key: 'description', label: 'Descrição' },
  ],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
    { key: 'description', label: 'Descrição', type: 'text' },
  ],
};

const adminTenantsConfig: EntityConfig = {
  title: 'Tenants',
  titleNew: 'Novo tenant',
  basePath: '/admin/tenants',
  idKey: 'id',
  listApi: adminApi.tenants.list,
  getApi: adminApi.tenants.get,
  createApi: (d) => adminApi.tenants.create(d),
  updateApi: (id, d) => adminApi.tenants.update(id, d),
  columns: [
    { key: 'name', label: 'Nome' },
    { key: 'slug', label: 'Slug' },
  ],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
    { key: 'slug', label: 'Slug', type: 'text', required: true },
  ],
};

const adminPlansConfig: EntityConfig = {
  title: 'Planos',
  titleNew: 'Novo plano',
  basePath: '/admin/plans',
  idKey: 'code',
  listApi: adminApi.plans.list,
  getApi: async (code) => {
    const list = await adminApi.plans.list();
    const arr = Array.isArray(list) ? list : (list as { items?: unknown[] }).items ?? [];
    const item = (arr as Record<string, unknown>[]).find((i) => i.code === code);
    return item ?? { code, name: '' };
  },
  createApi: (d) => adminApi.plans.create(d),
  updateApi: (code, d) => adminApi.plans.update(code, d),
  columns: [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nome' },
  ],
  fields: [
    { key: 'code', label: 'Código', type: 'text', required: true },
    { key: 'name', label: 'Nome', type: 'text' },
  ],
};

export const tenantEntityConfigs: Record<string, EntityConfig> = {
  users: tenantUsersConfig,
  organizations: tenantOrganizationsConfig,
  workspaces: tenantWorkspacesConfig,
  partners: tenantPartnersConfig,
  roles: tenantRolesConfig,
};

export const adminEntityConfigs: Record<string, EntityConfig> = {
  tenants: adminTenantsConfig,
  plans: adminPlansConfig,
  'platform-products': {
    title: 'Produtos (plataforma)',
    titleNew: 'Novo produto',
    basePath: '/admin/platform-products',
    idKey: 'id',
    listApi: adminApi.platformProducts.list,
    getApi: adminApi.platformProducts.get,
    createApi: (d) => adminApi.platformProducts.create(d),
    updateApi: (id, d) => adminApi.platformProducts.update(id, d),
    deleteApi: adminApi.platformProducts.delete,
    columns: [{ key: 'name', label: 'Nome' }, { key: 'code', label: 'Código' }],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true },
      { key: 'name', label: 'Nome', type: 'text', required: true },
    ],
  },
  permissions: {
    title: 'Permissões',
    titleNew: 'Nova permissão',
    basePath: '/admin/permissions',
    idKey: 'id',
    listApi: adminApi.permissions.list,
    getApi: adminApi.permissions.get,
    createApi: (d) => adminApi.permissions.create(d),
    updateApi: (id, d) => adminApi.permissions.update(id, d),
    deleteApi: adminApi.permissions.delete,
    columns: [{ key: 'resource', label: 'Recurso' }, { key: 'action', label: 'Ação' }],
    fields: [
      { key: 'resource', label: 'Recurso', type: 'text', required: true },
      { key: 'action', label: 'Ação', type: 'text', required: true },
    ],
  },
};

