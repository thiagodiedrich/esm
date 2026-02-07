/**
 * Módulo Admin: rotas /admin/tenants, /admin/plans, etc.
 * Renderiza listagem ou formulário conforme o path.
 */

import { useParams } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { EntityListPage } from '@/pages/entity/EntityListPage';
import { EntityFormPage } from '@/pages/entity/EntityFormPage';
import { adminEntityConfigs } from '@/pages/entity/entityConfig';

const DEFAULT_FIRST = 'tenants';

export function AdminModule() {
  const { '*': splat } = useParams<{ '*': string }>();
  const path = splat ?? '';
  const segments = path.split('/').filter(Boolean);
  const segment = segments[0];
  const sub = segments[1];

  if (!segment) {
    return <Navigate to={`/admin/${DEFAULT_FIRST}`} replace />;
  }

  const config = adminEntityConfigs[segment];
  if (!config) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Página não encontrada: /admin/{segment}
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
