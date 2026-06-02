import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  // 예약 생성 (이중 예약은 여기서 막힌다)
  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.booking.book(dto);
  }

  // 가능 시간 조회: GET /api/bookings/available?date=YYYY-MM-DD
  @Get('available')
  available(@Query('date') date: string) {
    return this.booking.available(date);
  }

  // 날짜별 예약 목록
  @Get()
  list(@Query('date') date: string) {
    return this.booking.listByDate(date);
  }

  // 예약 취소
  @Delete(':id')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.booking.cancel(id);
  }
}
