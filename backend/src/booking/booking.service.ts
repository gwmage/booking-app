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
        // 취소된(또는 노쇼) 예약이 같은 칸에 남아 있으면, 그 행을 되살려 재예약한다.
        // (취소는 행을 지우지 않고 status만 바꾸므로, 유일성 제약과 충돌하지 않게 재사용한다.)
        const existing = await tx.booking.findUnique({
          where: { date_slot: { date: dto.date, slot: dto.slot } },
        });
        if (existing) {
          if (existing.status === 'confirmed') {
            throw new ConflictException('이미 예약된 시간입니다. 다른 시간을 선택해주세요.');
          }
          return tx.booking.update({
            where: { id: existing.id },
            data: { name: dto.name, phone: dto.phone, status: 'confirmed', createdAt: new Date() },
          });
        }
        return tx.booking.create({
          data: { date: dto.date, slot: dto.slot, name: dto.name, phone: dto.phone },
        });
      });
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      // 유일성 제약 위반(P2002) = 동시 요청 중 둘째 예약 → 친절한 메시지로 변환
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

  // 예약 취소: status를 canceled로 바꿔 그 슬롯이 다시 예약 가능해지게 한다(이력은 남긴다).
  async cancel(id: number) {
    const found = await this.prisma.booking.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('예약을 찾을 수 없습니다.');
    await this.prisma.booking.update({ where: { id }, data: { status: 'canceled' } });
    return { canceled: true };
  }

  // 운영 통계: 예약 수·취소율·노쇼율·시간대별 예약 분포
  async stats() {
    const all = await this.prisma.booking.findMany();
    const n = all.length || 1;
    const confirmed = all.filter((b) => b.status === 'confirmed').length;
    const canceled = all.filter((b) => b.status === 'canceled').length;
    const noshow = all.filter((b) => b.status === 'noshow').length;
    // 시간대(슬롯)별 확정 예약 수
    const bySlot: Record<string, number> = {};
    for (const b of all) if (b.status === 'confirmed') bySlot[b.slot] = (bySlot[b.slot] || 0) + 1;
    const setting = await this.getSetting();
    const slots = this.buildSlots(setting.openHour, setting.closeHour, setting.slotMin);
    return {
      total: all.length,
      confirmed,
      canceled,
      noshow,
      cancelRate: Math.round((canceled / n) * 100),
      noshowRate: Math.round((noshow / n) * 100),
      slotDist: slots.map((s) => ({ slot: s, count: bySlot[s] || 0 })),
    };
  }
}
