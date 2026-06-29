-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "daily_report_enabled" BOOLEAN NOT NULL DEFAULT false,
    "daily_report_hour" INTEGER NOT NULL DEFAULT 9,
    "last_daily_report_date" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
