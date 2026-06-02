import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateBookingDto } from './dto';

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  // 영업시간·슬롯 설정을 읽는다(없으면 기본값으로 생성). 정책 값을 코드에 박지 않는다.
  private async getSetting() {
    let s = await this.prisma.setting.findFirst();
    if (!s) s = await this.prisma.setting.create({ data: {} });
    return s;
  }

  // 해당 날짜의 전체 슬롯 목록을 만든다 (예: 10:00 ~ 17:00, 1시간 단위)
  private buildSlots(openHour: number, closeHour: number, slotMin: number): string[] {
    const slots: string[] = [];
    for (let m = openHour * 60; m < closeHour * 60; m += slotMin) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    return slots;
  }

  // 예약 처리: 트랜잭션으로 '확인과 저장을 한 몸으로'. 유일성 제약 위반 시 친절히 안내.
  async book(dto: CreateBookingDto) {
    const setting = await this.getSetting();

    // 영업시간 밖 슬롯 거부
    const hour = Number(dto.slot.split(':')[0]);
    if (hour < setting.openHour || hour >= setting.closeHour) {
      throw new BadRequestException('영업시간 외 시간은 예약할 수 없습니다.');
    }
    // 지난 날짜 거부
    const today = new Date().toISOString().slice(0, 10);
    if (dto.date < today) {
      throw new BadRequestException('지난 날짜는 예약할 수 없습니다.');
    }

    try {
      // @@unique([date, slot]) 덕분에, 동시에 들어와도 단 한 건만 성공한다.
      return await this.prisma.$transaction(async (tx) => {
        return tx.booking.create({
          data: { date: dto.date, slot: dto.slot, name: dto.name, phone: dto.phone },
        });
      });
    } catch (e) {
      // 유일성 제약 위반(P2002) = 둘째 예약 → 친절한 메시지로 변환
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 예약된 시간입니다. 다른 시간을 선택해주세요.');
      }
      throw e;
    }
  }

  // 가능 시간 조회: 영업시간 슬롯 중 '아직 예약 안 된' 슬롯만 반환
  async available(date: string) {
    const setting = await this.getSetting();
    const all = this.buildSlots(setting.openHour, setting.closeHour, setting.slotMin);
    const booked = await this.prisma.booking.findMany({
      where: { date, status: 'confirmed' },
      select: { slot: true },
    });
    const taken = new Set(booked.map((b) => b.slot));
    return all.map((slot) => ({ slot, available: !taken.has(slot) }));
  }

  async listByDate(date: string) {
    return this.prisma.booking.findMany({
      where: { date },
      orderBy: { slot: 'asc' },
    });
  }

  // 예약 취소: 그 슬롯이 다시 예약 가능해지도록 행을 삭제한다.
  async cancel(id: number) {
    const found = await this.prisma.booking.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('예약을 찾을 수 없습니다.');
    await this.prisma.booking.delete({ where: { id } });
    return { canceled: true };
  }
}
