-- Merge request chats into the existing per-item conversation so each pair
-- of people has one inbox entry per item, regardless of how many requests exist.
INSERT INTO public."ItemConversation" ("id", "itemId", "requesterId", "createdAt")
SELECT gen_random_uuid(), pairs."itemId", pairs."requesterId", pairs."createdAt"
FROM (
  SELECT DISTINCT ON (r."itemId", r."requesterId")
    r."itemId", r."requesterId", r."createdAt"
  FROM public."LoanRequest" r
  ORDER BY r."itemId", r."requesterId", r."createdAt"
) AS pairs
WHERE true
ON CONFLICT ("itemId", "requesterId") DO NOTHING;

UPDATE public."ChatMessage" m
SET "conversationId" = c."id", "requestId" = NULL
FROM public."LoanRequest" r
JOIN public."ItemConversation" c
  ON c."itemId" = r."itemId" AND c."requesterId" = r."requesterId"
WHERE m."requestId" = r."id";

CREATE TABLE public."Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "message" VARCHAR(280) NOT NULL,
  "href" VARCHAR(512) NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_type_check" CHECK (
    "type" IN ('NEW_LISTING', 'NEW_REQUEST', 'REQUEST_UPDATED', 'NEW_MESSAGE', 'PAYMENT_RECEIVED', 'LOAN_RETURNED')
  )
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON public."Notification"("userId", "readAt", "createdAt");

ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.lendit_can_read_notification(target_user_id UUID)
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = ''
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public."User" u
          WHERE u."id" = target_user_id
            AND u."authUserId" = auth.uid()
            AND u."isActive" = true
        );
      $body$;
    $function$;
    REVOKE ALL ON FUNCTION public.lendit_can_read_notification(UUID) FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      GRANT SELECT ON public."Notification" TO authenticated;
      GRANT EXECUTE ON FUNCTION public.lendit_can_read_notification(UUID) TO authenticated;
      DROP POLICY IF EXISTS "notification_recipient_read" ON public."Notification";
      CREATE POLICY "notification_recipient_read"
        ON public."Notification" FOR SELECT TO authenticated
        USING (public.lendit_can_read_notification("userId"));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'Notification'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public."Notification";
    END IF;
  END IF;
END
$$;

ALTER TABLE public."Notification" REPLICA IDENTITY FULL;
