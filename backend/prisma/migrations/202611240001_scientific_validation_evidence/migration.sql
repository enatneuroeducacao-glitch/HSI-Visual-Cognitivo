CREATE TABLE "ScientificValidationEvidence" (
  "id" TEXT NOT NULL,
  "instrument" TEXT NOT NULL,
  "evidenceType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "versionScope" TEXT NOT NULL,
  "studyCode" TEXT,
  "protocolReference" TEXT,
  "methodDescription" TEXT NOT NULL,
  "population" TEXT NOT NULL,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "sampleDescription" TEXT NOT NULL,
  "findings" TEXT NOT NULL,
  "interpretation" TEXT NOT NULL,
  "limitations" TEXT NOT NULL,
  "ethicalStatus" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
  "ethicsReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "reviewer" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScientificValidationEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScientificValidationEvidence_instrument_evidenceType_status_idx" ON "ScientificValidationEvidence"("instrument","evidenceType","status");
CREATE INDEX "ScientificValidationEvidence_studyCode_idx" ON "ScientificValidationEvidence"("studyCode");
CREATE INDEX "ScientificValidationEvidence_createdAt_idx" ON "ScientificValidationEvidence"("createdAt");
