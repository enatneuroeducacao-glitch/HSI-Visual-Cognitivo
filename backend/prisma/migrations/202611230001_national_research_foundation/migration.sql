CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'COMPANY', 'PUBLIC_AGENCY', 'RESEARCH_CENTER', 'OTHER');

CREATE TABLE "Institution" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "InstitutionType" NOT NULL DEFAULT 'OTHER',
  "city" TEXT NOT NULL,
  "state" VARCHAR(2) NOT NULL,
  "country" VARCHAR(2) NOT NULL DEFAULT 'BR',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ParticipantGroup"
  ADD COLUMN "institutionId" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" VARCHAR(2);

ALTER TABLE "InstrumentAssessment"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "institutionId" TEXT,
  ADD COLUMN "contextVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "consentVersion" TEXT,
  ADD COLUMN "consentedAt" TIMESTAMP(3);

CREATE INDEX "Institution_state_city_idx" ON "Institution"("state", "city");
CREATE INDEX "Institution_type_active_idx" ON "Institution"("type", "active");
CREATE INDEX "InstrumentAssessment_context_completedAt_idx" ON "InstrumentAssessment"("context", "completedAt");
CREATE INDEX "InstrumentAssessment_institutionId_completedAt_idx" ON "InstrumentAssessment"("institutionId", "completedAt");
CREATE INDEX "InstrumentAssessment_groupId_completedAt_idx" ON "InstrumentAssessment"("groupId", "completedAt");

ALTER TABLE "ParticipantGroup" ADD CONSTRAINT "ParticipantGroup_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstrumentAssessment" ADD CONSTRAINT "InstrumentAssessment_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "ParticipantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstrumentAssessment" ADD CONSTRAINT "InstrumentAssessment_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
