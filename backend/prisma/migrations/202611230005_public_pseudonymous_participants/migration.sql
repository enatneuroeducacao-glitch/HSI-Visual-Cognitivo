ALTER TABLE "User"
  ADD COLUMN "publicAccess" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "birthDate" DATE,
  ADD COLUMN "sex" VARCHAR(1),
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" VARCHAR(2),
  ADD COLUMN "licenseCategory" TEXT,
  ADD COLUMN "institutionType" TEXT,
  ADD COLUMN "institutionName" TEXT,
  ADD COLUMN "groupSector" TEXT,
  ADD COLUMN "privacyNoticeVersion" TEXT,
  ADD COLUMN "privacyAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "researchConsentVersion" TEXT,
  ADD COLUMN "researchConsentedAt" TIMESTAMP(3);

CREATE INDEX "User_publicAccess_createdAt_idx" ON "User"("publicAccess", "createdAt");
CREATE INDEX "User_state_city_idx" ON "User"("state", "city");
