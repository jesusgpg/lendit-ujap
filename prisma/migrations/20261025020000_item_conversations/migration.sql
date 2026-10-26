CREATE TABLE "ItemConversation" (
  "id" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "requesterId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ItemConversation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ItemConversation_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ItemConversation_itemId_requesterId_key" ON "ItemConversation"("itemId", "requesterId");
CREATE INDEX "ItemConversation_requesterId_idx" ON "ItemConversation"("requesterId");
ALTER TABLE "ChatMessage" ALTER COLUMN "requestId" DROP NOT NULL;
ALTER TABLE "ChatMessage" ADD COLUMN "conversationId" UUID;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ItemConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_one_thread_check" CHECK (("requestId" IS NOT NULL)::int + ("conversationId" IS NOT NULL)::int = 1);
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
ALTER TABLE "ItemConversation" ENABLE ROW LEVEL SECURITY;

-- Browser writes remain forbidden. Only the authenticated server handlers write.
-- Policies read membership through a narrowly scoped function so unrelated RLS
-- rules on User/Item/LoanRequest do not prevent Realtime authorization.
CREATE FUNCTION public.lendit_can_read_chat(request_id UUID, conversation_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u."authUserId" = auth.uid() AND u."isActive" = true AND (
      EXISTS (SELECT 1 FROM public."LoanRequest" r JOIN public."Item" i ON i.id = r."itemId"
        WHERE r.id = request_id AND (u.id = r."requesterId" OR u.id = i."ownerId"))
      OR EXISTS (SELECT 1 FROM public."ItemConversation" c JOIN public."Item" i ON i.id = c."itemId"
        WHERE c.id = conversation_id AND (u.id = c."requesterId" OR u.id = i."ownerId"))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.lendit_can_read_chat(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lendit_can_read_chat(UUID, UUID) TO authenticated;
DROP POLICY IF EXISTS "chat_messages_select_participant" ON "ChatMessage";
CREATE POLICY "chat_messages_select_participant" ON "ChatMessage" FOR SELECT TO authenticated
  USING (public.lendit_can_read_chat("requestId", "conversationId"));
GRANT SELECT ON "ChatMessage" TO authenticated;
-- ItemConversation is only accessed through the API, so no browser grants/policy.
