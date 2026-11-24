CREATE TABLE "ParticipantDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParticipantDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParticipantDraft_userId_instrument_key"
ON "ParticipantDraft"("userId", "instrument");

CREATE INDEX "ParticipantDraft_expiresAt_idx"
ON "ParticipantDraft"("expiresAt");

ALTER TABLE "ParticipantDraft"
ADD CONSTRAINT "ParticipantDraft_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
