import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ListingSource {
  MOBILE_DE = 'mobile.de',
  OTOMOTO = 'otomoto',
  BAZOS = 'bazos',
  AUTOSCOUT = 'auto-scout',
}

export enum ListingStatus {
  NEW = 'new',
  PROCESSED = 'processed',
  CONTACTED = 'contacted',
  REJECTED = 'rejected',
}

export enum SellerType {
  PRIVATE = 'private',
  DEALER = 'dealer',
  UNKNOWN = 'unknown',
}

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  externalId: string;

  @Column({
    type: 'simple-enum',
    enum: ListingSource,
  })
  source: ListingSource;

  @Column()
  url: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ nullable: true })
  currency: string;

  @Column({ nullable: true })
  make: string;

  @Column({ nullable: true })
  model: string;

  @Column({ nullable: true })
  year: number;

  @Column({ nullable: true })
  mileage: number;

  @Column({ nullable: true })
  fuelType: string;

  @Column({ nullable: true })
  transmission: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  sellerName: string;

  @Column({ nullable: true })
  sellerPhone: string;

  @Column({
    type: 'simple-enum',
    enum: SellerType,
    default: SellerType.UNKNOWN,
  })
  sellerType: SellerType;

  @Column({
    type: 'simple-enum',
    enum: ListingStatus,
    default: ListingStatus.NEW,
  })
  status: ListingStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'datetime', nullable: true })
  contactedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  rawData: any;
}
