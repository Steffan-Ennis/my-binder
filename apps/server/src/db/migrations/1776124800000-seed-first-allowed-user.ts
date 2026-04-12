import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedFirstAllowedUser1776124800000 implements MigrationInterface {
    name = 'SeedFirstAllowedUser1776124800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "allowed_user_entity" ("email") VALUES ($1) ON CONFLICT ("email") DO NOTHING`,
            ['steffanennis87@gmail.com'],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM "allowed_user_entity" WHERE "email" = $1`,
            ['steffanennis87@gmail.com'],
        );
    }

}
