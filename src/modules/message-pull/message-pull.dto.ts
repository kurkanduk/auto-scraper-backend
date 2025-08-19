// dto/create-message.dto.ts
export class CreateMessageDto {
  title: string;
  content: string;
  isActive?: boolean;
}

// dto/update-message.dto.ts
export class UpdateMessageDto {
  title?: string;
  content?: string;
  isActive?: boolean;
}
