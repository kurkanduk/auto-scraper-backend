import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Listing } from './listing.entity';

export enum ContactStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

@Entity('contact_logs')
export class ContactLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  listingId: number;

  @ManyToOne(() => Listing)
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column()
  phoneNumber: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'simple-enum',
    enum: ContactStatus,
    default: ContactStatus.SENT,
  })
  status: ContactStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  sentAt: Date;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date;
}
