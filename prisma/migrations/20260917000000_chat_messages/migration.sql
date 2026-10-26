-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_requestId_createdAt_idx" ON "ChatMessage"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LoanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;

-- Configure permissions and Realtime publication for Supabase
DO $$
BEGIN
  -- Grant SELECT to authenticated role for Realtime subscription
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT ON "ChatMessage" TO authenticated';
  END IF;

  -- Add ChatMessage to supabase_realtime publication
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ChatMessage'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE "ChatMessage"';
    END IF;
  END IF;

  -- Set replica identity to full so Realtime events include all record data
  EXECUTE 'ALTER TABLE "ChatMessage" REPLICA IDENTITY FULL';
END
$$;

-- RLS SELECT policy: auth.uid() maps via User.authUserId to requester or owner
DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NOT NULL AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'DROP POLICY IF EXISTS "chat_messages_select_participant" ON "ChatMessage"';
    EXECUTE $policy$
      CREATE POLICY "chat_messages_select_participant"
        ON "ChatMessage" FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM "User" u
            JOIN "LoanRequest" lr ON lr."id" = "ChatMessage"."requestId"
            JOIN "Item" i ON i."id" = lr."itemId"
            WHERE u."authUserId" = auth.uid()
              AND (u."id" = lr."requesterId" OR u."id" = i."ownerId")
          )
        )
    $policy$;
  END IF;
END
$$;
