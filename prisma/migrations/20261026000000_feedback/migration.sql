-- Feedback sent to the app's owner from the app; the message is stored only encrypted.
CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "message_enc" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at");
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
