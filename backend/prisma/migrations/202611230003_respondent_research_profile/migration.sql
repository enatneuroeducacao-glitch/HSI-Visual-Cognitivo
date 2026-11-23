ALTER TABLE "InstrumentAssessment"
  ADD COLUMN "birthDate" DATE,
  ADD COLUMN "sex" VARCHAR(1),
  ADD COLUMN "licenseCategory" TEXT,
  ADD COLUMN "institutionType" TEXT,
  ADD COLUMN "institutionName" TEXT,
  ADD COLUMN "groupSector" TEXT;

CREATE INDEX "InstrumentAssessment_institutionType_institutionName_idx"
  ON "InstrumentAssessment"("institutionType", "institutionName");
