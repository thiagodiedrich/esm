/**
 * Módulo Tenant: rotas /tenant/users, /tenant/organizations, etc.
 * Renderiza listagem ou formulário conforme o path.
 */

import { useParams } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { EntityListPage } from '@/pages/entity/EntityListPage';
import { EntityFormPage } from '@/pages/entity/EntityFormPage';
import { tenantEntityConfigs } from '@/pages/entity/entityConfig';

const DEFAULT_FIRST = 'users';

export function TenantModule() {
  const { '*': splat } = useParams<{ '*': string }>();
  const path = splat ?? '';
  const segments = path.split('/').filter(Boolean);
  const segment = segments[0];
  const sub = segments[1];

  if (!segment) {
    return <Navigate to={`/tenant/${DEFAULT_FIRST}`} replace />;
  }

  const config = tenantEntityConfigs[segment];
  if (!config) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Página não encontrada: /tenant/{segment}
      </div>
    );
  }

  if (sub === 'new') {
    return <EntityFormPage config={config} idOverride="new" />;
  }
  if (sub) {
    return <EntityFormPage config={config} idOverride={sub} />;
  }
  return <EntityListPage config={config} />;
}
