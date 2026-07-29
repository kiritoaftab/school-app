-- Who changed what, and when.
--
-- The table carries no foreign keys on purpose. An audit trail that becomes
-- unreadable the moment its subject is purged is not an audit trail, so the
-- actor's name and the target's label are snapshotted as text at write time.
-- That is the one place in this schema where denormalising a name is right:
-- everywhere else history joins to a row we now guarantee still exists.
--
-- Purely additive — no existing table is touched.

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schoolId` INTEGER NULL,
    `actorId` INTEGER NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `actorRole` ENUM('PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE', 'DELETE', 'PURGE', 'LOGIN') NOT NULL,
    `entity` VARCHAR(40) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_schoolId_createdAt_idx`(`schoolId`, `createdAt`),
    INDEX `AuditLog_entity_entityId_createdAt_idx`(`entity`, `entityId`, `createdAt`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
