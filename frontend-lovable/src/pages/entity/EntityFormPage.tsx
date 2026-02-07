/**
 * Página genérica de formulário: criar ou editar registro.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import type { EntityConfig } from './entityConfig';

interface EntityFormPageProps {
  config: EntityConfig;
  /** Quando usado dentro de módulo com splat (ex.: TenantModule), o id vem pela prop. */
  idOverride?: string;
}

export function EntityFormPage({ config, idOverride }: EntityFormPageProps) {
  const paramsId = useParams<{ id: string }>().id;
  const id = idOverride ?? paramsId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [formError, setFormError] = useState('');

  const { data, isLoading: loadingGet } = useQuery({
    queryKey: [config.basePath, id],
    queryFn: () => config.getApi(id!),
    enabled: !isNew && !!id,
  });

  useEffect(() => {
    if (data && typeof data === 'object') {
      const next: Record<string, string | boolean> = {};
      config.fields.forEach((f) => {
        const v = (data as Record<string, unknown>)[f.key];
        if (f.type === 'checkbox') next[f.key] = Boolean(v);
        else next[f.key] = v != null ? String(v) : '';
      });
      setForm(next);
    } else if (isNew) {
      const next: Record<string, string | boolean> = {};
      config.fields.forEach((f) => {
        next[f.key] = f.type === 'checkbox' ? false : '';
      });
      setForm(next);
    }
  }, [data, isNew, config.fields]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => config.createApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.basePath, 'list'] });
      navigate(config.basePath);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => config.updateApi(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.basePath, 'list'] });
      queryClient.invalidateQueries({ queryKey: [config.basePath, id] });
      navigate(config.basePath);
    },
  });

  const currentContext = useAuthStore((s) => s.currentContext);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload: Record<string, unknown> = {};
    config.fields.forEach((f) => {
      if (f.key === 'password' && form[f.key] === '') return;
      payload[f.key] = f.type === 'checkbox' ? form[f.key] : form[f.key];
    });
    const orgId = currentContext?.organization_id;
    // Backend exige organization_id ao criar usuário (para criar o partner)
    if (config.basePath === '/tenant/users' && isNew) {
      if (!orgId) {
        setFormError('Selecione uma organização no seletor (canto superior) antes de criar o usuário.');
        return;
      }
      payload.organization_id = orgId;
      if ((payload.name === '' || payload.name == null) && payload.email) payload.name = payload.email;
    }
    // Backend exige organization_id ao criar workspace
    if (config.basePath === '/tenant/workspaces' && isNew) {
      if (!orgId) {
        setFormError('Selecione uma organização no seletor (canto superior) antes de criar o workspace.');
        return;
      }
      payload.organization_id = orgId;
    }
    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(config.basePath)}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{isNew ? config.titleNew : `Editar ${config.title.toLowerCase()}`}</CardTitle>
          <CardDescription>
            {isNew ? 'Preencha os campos para criar.' : 'Altere os campos e salve.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isNew && loadingGet ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && ' *'}
                  </Label>
                  {field.type === 'checkbox' ? (
                    <input
                      id={field.key}
                      type="checkbox"
                      checked={Boolean(form[field.key])}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [field.key]: e.target.checked }))
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-input"
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={String(form[field.key] ?? '')}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      required={field.required}
                      disabled={isPending}
                    />
                  )}
                </div>
              ))}
              {(formError || error) && (
                <p className="text-sm text-destructive">
                  {formError || ((error as Error)?.message) || 'Erro ao salvar.'}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    isNew ? 'Criar' : 'Salvar'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(config.basePath)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
