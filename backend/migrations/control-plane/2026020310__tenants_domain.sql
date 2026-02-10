BEGIN;

-- Campo domain: um ou mais dominios separados por virgula (ex.: localhost,localhost:3000,easytest.simc.com.br)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS domain TEXT;

-- Atualiza o tenant principal (super_tenant) com dominios padrao para desenvolvimento e testes.
-- Em producao, ajuste via UPDATE ou use TENANT_DEFAULT_DOMAIN no bootstrap.
UPDATE tenants
SET domain = 'localhost,localhost:3000,localhost:8080,easytest.simc.com.br,easytestapi.simc.com.br',
    updated_at = now()
WHERE is_super_tenant = true
  AND (domain IS NULL OR domain = '')
  AND (SELECT COUNT(*) FROM tenants) >= 1;

COMMIT;
