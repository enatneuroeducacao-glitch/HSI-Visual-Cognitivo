CREATE TYPE "ScientificStatus" AS ENUM ('DRAFT','ACTIVE','PAUSED','COMPLETED','ARCHIVED');

CREATE TABLE "InstrumentVersion" (
  "id" TEXT NOT NULL,
  "instrument" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "changeSummary" TEXT NOT NULL,
  "questions" JSONB NOT NULL,
  "scoringCriteria" JSONB NOT NULL,
  "createdBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstrumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InstrumentVersion_instrument_version_key" ON "InstrumentVersion"("instrument","version");
CREATE INDEX "InstrumentVersion_instrument_status_idx" ON "InstrumentVersion"("instrument","status");

CREATE TABLE "StudyProtocol" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0',
  "researchQuestion" TEXT NOT NULL,
  "hypothesis" TEXT NOT NULL,
  "targetPopulation" TEXT NOT NULL,
  "inclusionCriteria" TEXT NOT NULL,
  "exclusionCriteria" TEXT NOT NULL,
  "samplingStrategy" TEXT NOT NULL,
  "sampleSizeRationale" TEXT NOT NULL,
  "analysisPlan" TEXT NOT NULL,
  "ethicalConsiderations" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyProtocol_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudyProtocol_title_idx" ON "StudyProtocol"("title");

CREATE TABLE "ScientificStudy" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "hypothesis" TEXT NOT NULL,
  "targetPopulation" TEXT NOT NULL,
  "inclusionCriteria" TEXT NOT NULL,
  "exclusionCriteria" TEXT,
  "samplingPlan" TEXT NOT NULL,
  "analysisPlan" TEXT NOT NULL,
  "status" "ScientificStatus" NOT NULL DEFAULT 'DRAFT',
  "protocolId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScientificStudy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScientificStudy_code_key" ON "ScientificStudy"("code");
CREATE INDEX "ScientificStudy_status_createdAt_idx" ON "ScientificStudy"("status","createdAt");
ALTER TABLE "ScientificStudy" ADD CONSTRAINT "ScientificStudy_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "StudyProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudyGroup" (
  "id" TEXT NOT NULL,
  "studyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "arm" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudyGroup_studyId_code_key" ON "StudyGroup"("studyId","code");
CREATE INDEX "StudyGroup_studyId_arm_idx" ON "StudyGroup"("studyId","arm");
ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ScientificStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentResult"
  ADD COLUMN "instrumentVersionId" TEXT,
  ADD COLUMN "scoringSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "versionVerification" TEXT NOT NULL DEFAULT 'UNVERIFIED_LEGACY',
  ADD COLUMN "studyId" TEXT,
  ADD COLUMN "studyGroupId" TEXT;
ALTER TABLE "InstrumentAssessment"
  ADD COLUMN "instrumentVersionId" TEXT,
  ADD COLUMN "scoringSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "versionVerification" TEXT NOT NULL DEFAULT 'UNVERIFIED_LEGACY',
  ADD COLUMN "studyId" TEXT,
  ADD COLUMN "studyGroupId" TEXT;

ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstrumentAssessment" ADD CONSTRAINT "InstrumentAssessment_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ScientificStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstrumentAssessment" ADD CONSTRAINT "InstrumentAssessment_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ScientificStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_studyGroupId_fkey" FOREIGN KEY ("studyGroupId") REFERENCES "StudyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstrumentAssessment" ADD CONSTRAINT "InstrumentAssessment_studyGroupId_fkey" FOREIGN KEY ("studyGroupId") REFERENCES "StudyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AssessmentResult_instrumentVersionId_idx" ON "AssessmentResult"("instrumentVersionId");
CREATE INDEX "AssessmentResult_studyId_completedAt_idx" ON "AssessmentResult"("studyId","completedAt");
CREATE INDEX "InstrumentAssessment_instrumentVersionId_idx" ON "InstrumentAssessment"("instrumentVersionId");
CREATE INDEX "InstrumentAssessment_studyId_completedAt_idx" ON "InstrumentAssessment"("studyId","completedAt");

-- Registros anteriores à governança científica permanecem explicitamente não verificados.
-- Não associar retroativamente critérios atuais a aplicações históricas.
