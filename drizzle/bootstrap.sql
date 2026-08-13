-- Idempotent schema bootstrap for a fresh MySQL database.
-- Mirrors drizzle/schema.ts. Safe to run on every container start
-- (CREATE TABLE IF NOT EXISTS). FKs are intentionally omitted (same as
-- the queried drizzle migrations used for this app).

CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users__openId` (`openId`)
);

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerId` int NOT NULL,
  `assigneeId` int,
  `title` varchar(255) NOT NULL,
  `description` text,
  `status` enum('To Do','In Progress','Done','Blocked') NOT NULL DEFAULT 'To Do',
  `priority` enum('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium',
  `dueDate` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `taskLinks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerId` int NOT NULL,
  `sourceTaskId` int NOT NULL,
  `targetTaskId` int NOT NULL,
  `relationshipType` enum('blocks','is blocked by','relates to','duplicates','parent/child') NOT NULL,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `comments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `taskId` int NOT NULL,
  `authorId` int NOT NULL,
  `content` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `activityLogs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `taskId` int NOT NULL,
  `actorId` int NOT NULL,
  `eventType` enum('status_change','link_created','comment','edit') NOT NULL,
  `message` text NOT NULL,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
);