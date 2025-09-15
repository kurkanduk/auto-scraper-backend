import { ListingSource } from '../../entities/listing.entity';

// dto/create-message.dto.ts
export class CreateMessageDto {
  content: string;
  source: ListingSource;
  isActive?: boolean;
}

// dto/update-message.dto.ts
export class UpdateMessageDto {
  content?: string;
  source?: ListingSource;
  isActive?: boolean;
}
