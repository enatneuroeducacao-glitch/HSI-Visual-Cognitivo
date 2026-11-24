ALTER TABLE "User" ADD COLUMN "researchConsentGranted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssessmentResult"
  ADD COLUMN "researchConsentGranted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "researchConsentVersion" TEXT,
  ADD COLUMN "researchConsentedAt" TIMESTAMP(3);
ALTER TABLE "InstrumentAssessment" ADD COLUMN "researchConsentGranted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ConsentEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "privacyNoticeVersion" TEXT,
  "instrument" TEXT,
  "assessmentId" TEXT,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConsentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ConsentEvent_userId_createdAt_idx" ON "ConsentEvent"("userId","createdAt");
CREATE INDEX "ConsentEvent_purpose_granted_createdAt_idx" ON "ConsentEvent"("purpose","granted","createdAt");

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status","createdAt");
CREATE INDEX "PrivacyRequest_userId_createdAt_idx" ON "PrivacyRequest"("userId","createdAt");

CREATE TABLE "RetentionPolicy" (
  "id" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "retentionMonths" INTEGER NOT NULL,
  "rationale" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RetentionPolicy_recordType_key" ON "RetentionPolicy"("recordType");
