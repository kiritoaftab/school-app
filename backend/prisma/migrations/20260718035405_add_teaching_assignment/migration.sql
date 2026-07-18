-- CreateTable
CREATE TABLE `TeachingAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schoolId` INTEGER NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `klassId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,

    INDEX `TeachingAssignment_schoolId_idx`(`schoolId`),
    INDEX `TeachingAssignment_klassId_idx`(`klassId`),
    INDEX `TeachingAssignment_teacherId_idx`(`teacherId`),
    UNIQUE INDEX `TeachingAssignment_teacherId_klassId_subjectId_key`(`teacherId`, `klassId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeachingAssignment` ADD CONSTRAINT `TeachingAssignment_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `School`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeachingAssignment` ADD CONSTRAINT `TeachingAssignment_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeachingAssignment` ADD CONSTRAINT `TeachingAssignment_klassId_fkey` FOREIGN KEY (`klassId`) REFERENCES `Klass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeachingAssignment` ADD CONSTRAINT `TeachingAssignment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;