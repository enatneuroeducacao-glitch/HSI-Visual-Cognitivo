ALTER TABLE "InstrumentAssessment"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" VARCHAR(2);

CREATE INDEX "InstrumentAssessment_state_city_completedAt_idx"
  ON "InstrumentAssessment"("state", "city", "completedAt");
