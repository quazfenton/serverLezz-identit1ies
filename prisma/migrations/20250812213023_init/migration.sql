-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latitude" REAL,
    "longitude" REAL,
    "city" TEXT,
    "country" TEXT,
    "resources" JSONB,
    "economicProfile" JSONB,
    "behaviorProfile" JSONB,
    "reputation" JSONB,
    "weight" REAL NOT NULL DEFAULT 0.5,
    "tags" JSONB
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "providerId" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "city" TEXT,
    "country" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "pricing" JSONB,
    "availability" JSONB,
    "requirements" JSONB,
    "qualityMetrics" JSONB,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "listings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "strength" REAL NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "interactions" JSONB,
    CONSTRAINT "connections_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "totalListings" INTEGER NOT NULL DEFAULT 0,
    "activeListings" INTEGER NOT NULL DEFAULT 0,
    "successfulMatches" INTEGER NOT NULL DEFAULT 0,
    "totalUtility" REAL NOT NULL DEFAULT 0,
    "wasteLevel" REAL NOT NULL DEFAULT 0,
    "efficiencyScore" REAL NOT NULL DEFAULT 0,
    "equityIndex" REAL NOT NULL DEFAULT 0,
    "socialWelfare" REAL NOT NULL DEFAULT 0,
    "coordinationCost" REAL NOT NULL DEFAULT 0,
    "networkHealth" REAL NOT NULL DEFAULT 0,
    "adaptationSpeed" REAL NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "connections_fromId_toId_key" ON "connections"("fromId", "toId");
