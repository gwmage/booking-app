import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: '시간은 HH:MM 형식이어야 합니다.' })
  slot: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone: string;
}
