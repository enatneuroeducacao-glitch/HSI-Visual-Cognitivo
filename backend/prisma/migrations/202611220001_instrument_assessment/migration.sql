CREATE TABLE "InstrumentAssessment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instrument" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "answers" JSONB NOT NULL,
  "dimensions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstrumentAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InstrumentAssessment_userId_completedAt_idx" ON "InstrumentAssessment"("userId","completedAt");
CREATE INDEX "InstrumentAssessment_instrument_completedAt_idx" ON "InstrumentAssessment"("instrument","completedAt");
ALTER TABLE "InstrumentAssessment" ADD CONSTRAINT "InstrumentAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
