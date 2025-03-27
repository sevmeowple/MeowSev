// entities/PrivateMessage.ts
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("private_messages")
export class PrivateMessage {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    sender_id!: string;

    @Column()
    receiver_id!: string;

    @Column()
    content!: string;

    @Column()
    formatted_message!: string;

    @Column("bigint")
    timestamp!: number;
}