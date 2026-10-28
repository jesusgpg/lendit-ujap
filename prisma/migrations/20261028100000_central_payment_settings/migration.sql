CREATE TABLE "CentralPaymentSettings" (
  "id" VARCHAR(20) NOT NULL DEFAULT 'central',
  "holder" VARCHAR(120) NOT NULL,
  "bank" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(30) NOT NULL,
  "nationalId" VARCHAR(20) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CentralPaymentSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CentralPaymentSettings_singleton_check" CHECK ("id" = 'central')
);

ALTER TABLE public."CentralPaymentSettings" ENABLE ROW LEVEL SECURITY;

INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES (gen_random_uuid(), 'payments.manage', 'Configurar la cuenta central que recibe pagos móviles', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" = 'ADMIN' AND p."key" = 'payments.manage'
ON CONFLICT DO NOTHING;
