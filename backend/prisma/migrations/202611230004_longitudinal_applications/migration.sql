ALTER TABLE "AssessmentResult"
  ADD COLUMN "applicationNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "applicationType" TEXT NOT NULL DEFAULT 'BASELINE',
  ADD COLUMN "studyCode" TEXT,
  ADD COLUMN "instrumentVersion" TEXT NOT NULL DEFAULT '1.0';

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "userId" ORDER BY "completedAt" ASC, "createdAt" ASC, "id" ASC
  )::INTEGER AS sequence
  FROM "AssessmentResult"
)
UPDATE "AssessmentResult" AS target
SET "applicationNumber" = ranked.sequence,
    "applicationType" = CASE WHEN ranked.sequence = 1 THEN 'BASELINE' ELSE 'REEVALUATION' END
FROM ranked
WHERE target."id" = ranked."id";

CREATE UNIQUE INDEX "AssessmentResult_userId_applicationNumber_key"
  ON "AssessmentResult"("userId", "applicationNumber");

ALTER TABLE "InstrumentAssessment"
  ADD COLUMN "applicationNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "applicationType" TEXT NOT NULL DEFAULT 'BASELINE',
  ADD COLUMN "studyCode" TEXT,
  ADD COLUMN "instrumentVersion" TEXT NOT NULL DEFAULT '1.0';

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "userId", "instrument" ORDER BY "completedAt" ASC, "createdAt" ASC, "id" ASC
  )::INTEGER AS sequence
  FROM "InstrumentAssessment"
)
UPDATE "InstrumentAssessment" AS target
SET "applicationNumber" = ranked.sequence,
    "applicationType" = CASE WHEN ranked.sequence = 1 THEN 'BASELINE' ELSE 'REEVALUATION' END
FROM ranked
WHERE target."id" = ranked."id";

CREATE UNIQUE INDEX "InstrumentAssessment_userId_instrument_applicationNumber_key"
  ON "InstrumentAssessment"("userId", "instrument", "applicationNumber");

CREATE INDEX "AssessmentResult_applicationType_completedAt_idx"
  ON "AssessmentResult"("applicationType", "completedAt");
CREATE INDEX "InstrumentAssessment_applicationType_completedAt_idx"
  ON "InstrumentAssessment"("applicationType", "completedAt");
