import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BookingController } from './booking/booking.controller';
import { BookingService } from './booking/booking.service';

@Module({
  controllers: [BookingController],
  providers: [PrismaService, BookingService],
})
export class AppModule {}
