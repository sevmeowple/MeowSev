// entities/GroupMessage.ts
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("group_messages")
export class GroupMessage {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    sender_id!: string;

    @Column()
    group_id!: string;

    @Column()
    content!: string;

    @Column()
    formatted_message!: string;

    @Column("bigint")
    timestamp!: number;
}