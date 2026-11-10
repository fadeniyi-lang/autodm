-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TrackedLinkPurpose" AS ENUM ('REVEAL', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "WorkspaceInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DmStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED_DEDUP', 'SKIPPED_RATE_LIMIT', 'SKIPPED_PLAN_LIMIT', 'SKIPPED_NO_MATCH', 'SKIPPED_DM_DISABLED', 'SKIPPED_INELIGIBLE');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "OperationalEventSource" AS ENUM ('WORKER', 'TOKEN_REFRESH', 'HEALTH', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OperationalEventLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "InstagramProvider" AS ENUM ('META', 'ZERNIO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usagePeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dmsSentThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "connectorTokenHash" TEXT,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "WorkspaceInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "provider" "InstagramProvider" NOT NULL DEFAULT 'META',
    "zernioAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "webhookSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowerSnapshot" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followersCount" INTEGER NOT NULL,
    "backfilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaInsightCache" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "views" INTEGER,
    "reach" INTEGER,
    "saved" INTEGER,
    "shares" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaInsightCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "postId" TEXT,
    "postUrl" TEXT,
    "pendingNextReel" BOOLEAN NOT NULL DEFAULT false,
    "matchAnyPost" BOOLEAN NOT NULL DEFAULT false,
    "keywords" TEXT[],
    "matchAnyWord" BOOLEAN NOT NULL DEFAULT false,
    "dmTriggerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dmMessage" TEXT NOT NULL,
    "openingDmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "openingDmMessage" TEXT,
    "openingDmButtonLabel" TEXT,
    "linkButtonLabel" TEXT,
    "requireFollow" BOOLEAN NOT NULL DEFAULT false,
    "followPromptMessage" TEXT,
    "followPromptButtonLabel" TEXT,
    "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "followUpMessage" TEXT,
    "followUpDelayMinutes" INTEGER NOT NULL DEFAULT 0,
    "followUpButtonLabel" TEXT,
    "publicReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicReplyMessage" TEXT,
    "publicReplyMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commentDmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wholeWordMatch" BOOLEAN NOT NULL DEFAULT true,
    "reportShareSlug" TEXT,
    "reportShareEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "commenterId" TEXT NOT NULL,
    "commenterName" TEXT,
    "commentText" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "matchedKeyword" TEXT,
    "status" "DmStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dmSentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "dmDeliveryUnconfirmed" BOOLEAN NOT NULL DEFAULT false,
    "publicReplyDeliveryUnconfirmed" BOOLEAN NOT NULL DEFAULT false,
    "publicReplySentAt" TIMESTAMP(3),
    "publicReplyError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedComment" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT,
    "destinationUrl" TEXT NOT NULL,
    "purpose" "TrackedLinkPurpose" NOT NULL DEFAULT 'REVEAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "trackedLinkId" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "object" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "source" "OperationalEventSource" NOT NULL,
    "level" "OperationalEventLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZernioConnection" (
    "workspaceId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "profileId" TEXT,
    "webhookId" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZernioConnection_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "PostbackDelivery" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostbackDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_connectorTokenHash_key" ON "Workspace"("connectorTokenHash");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "WorkspaceInvitation"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_email_idx" ON "WorkspaceInvitation"("email");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_workspaceId_idx" ON "WorkspaceInvitation"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_status_idx" ON "WorkspaceInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_workspaceId_email_key" ON "WorkspaceInvitation"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_instagramId_key" ON "InstagramAccount"("instagramId");

-- CreateIndex
CREATE INDEX "InstagramAccount_workspaceId_idx" ON "InstagramAccount"("workspaceId");

-- CreateIndex
CREATE INDEX "FollowerSnapshot_instagramAccountId_date_idx" ON "FollowerSnapshot"("instagramAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FollowerSnapshot_instagramAccountId_date_key" ON "FollowerSnapshot"("instagramAccountId", "date");

-- CreateIndex
CREATE INDEX "MediaInsightCache_instagramAccountId_idx" ON "MediaInsightCache"("instagramAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaInsightCache_instagramAccountId_mediaId_key" ON "MediaInsightCache"("instagramAccountId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_reportShareSlug_key" ON "Automation"("reportShareSlug");

-- CreateIndex
CREATE INDEX "Automation_workspaceId_idx" ON "Automation"("workspaceId");

-- CreateIndex
CREATE INDEX "Automation_instagramAccountId_idx" ON "Automation"("instagramAccountId");

-- CreateIndex
CREATE INDEX "Automation_postId_idx" ON "Automation"("postId");

-- CreateIndex
CREATE INDEX "DmLog_workspaceId_idx" ON "DmLog"("workspaceId");

-- CreateIndex
CREATE INDEX "DmLog_automationId_idx" ON "DmLog"("automationId");

-- CreateIndex
CREATE INDEX "DmLog_instagramAccountId_idx" ON "DmLog"("instagramAccountId");

-- CreateIndex
CREATE INDEX "DmLog_status_idx" ON "DmLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DmLog_automationId_commentId_key" ON "DmLog"("automationId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedComment_commentId_key" ON "ProcessedComment"("commentId");

-- CreateIndex
CREATE INDEX "ProcessedComment_instagramAccountId_idx" ON "ProcessedComment"("instagramAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedLink_slug_key" ON "TrackedLink"("slug");

-- CreateIndex
CREATE INDEX "TrackedLink_workspaceId_idx" ON "TrackedLink"("workspaceId");

-- CreateIndex
CREATE INDEX "TrackedLink_automationId_idx" ON "TrackedLink"("automationId");

-- CreateIndex
CREATE INDEX "LinkClick_workspaceId_idx" ON "LinkClick"("workspaceId");

-- CreateIndex
CREATE INDEX "LinkClick_automationId_idx" ON "LinkClick"("automationId");

-- CreateIndex
CREATE INDEX "LinkClick_instagramAccountId_idx" ON "LinkClick"("instagramAccountId");

-- CreateIndex
CREATE INDEX "LinkClick_trackedLinkId_idx" ON "LinkClick"("trackedLinkId");

-- CreateIndex
CREATE INDEX "LinkClick_createdAt_idx" ON "LinkClick"("createdAt");

-- CreateIndex
CREATE INDEX "LinkClick_workspaceId_createdAt_idx" ON "LinkClick"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_workspaceId_idx" ON "WebhookEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "OperationalEvent_workspaceId_idx" ON "OperationalEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "OperationalEvent_source_idx" ON "OperationalEvent"("source");

-- CreateIndex
CREATE INDEX "OperationalEvent_level_idx" ON "OperationalEvent"("level");

-- CreateIndex
CREATE INDEX "OperationalEvent_createdAt_idx" ON "OperationalEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowerSnapshot" ADD CONSTRAINT "FollowerSnapshot_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaInsightCache" ADD CONSTRAINT "MediaInsightCache_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmLog" ADD CONSTRAINT "DmLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmLog" ADD CONSTRAINT "DmLog_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmLog" ADD CONSTRAINT "DmLog_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_trackedLinkId_fkey" FOREIGN KEY ("trackedLinkId") REFERENCES "TrackedLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalEvent" ADD CONSTRAINT "OperationalEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZernioConnection" ADD CONSTRAINT "ZernioConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

