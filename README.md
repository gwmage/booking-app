# 예약·주문 관리 앱 — 이중 예약 없는 예약 시스템

도서 **《설계 지능》(이지스퍼블리싱)**의 **실전 프로젝트 IV** 예제 소스입니다.
같은 시간을 두 명이 동시에 노려도 **단 한 명만** 예약되는, '동시성'을 다루는 예약 앱입니다.

## 핵심 개념
- **유일성 제약** `@@unique([date, slot])`: 같은 날짜+시간 조합은 데이터베이스가 단 하나만 허용 → 이중 예약을 마지막 관문에서 차단
- **트랜잭션**: 확인과 저장을 한 몸으로 처리
- 유일성 위반 시 "이미 예약된 시간입니다. 다른 시간을 선택해주세요"로 우아하게 안내

## 기술 스택
| 영역 | 도구 |
|------|------|
| 백엔드 | NestJS + Prisma |
| 데이터베이스 | SQLite(로컬, 추가 설치 0) / PostgreSQL(배포 시) |
| 프론트엔드 | 정적 HTML + Tailwind (참고용 최소 화면) |

## 실행 방법
```
# 1) 백엔드
cd backend
npm install
cp .env.example .env          # (Windows: copy .env.example .env)
npm run prisma:push           # SQLite dev.db 생성
npm start                     # http://localhost:3001

# 2) 프론트엔드 (다른 터미널)
cd frontend
python -m http.server 3000    # http://localhost:3000
```

## 동시성 동작 확인
백엔드 실행 후:
```
cd backend
npm run test:concurrency
```
→ 같은 슬롯에 10건을 동시에 보내 **정확히 1건만 성공(201), 9건 거절(409)** 되는지 검증합니다.
화면에서도 '⚡ 동시 예약 시뮬레이션' 버튼으로 같은 결과를 눈으로 확인할 수 있습니다.

> ⚠️ `.env`와 `*.db`(고객 정보 포함 가능)는 절대 깃허브에 올리지 마세요. (`.gitignore`로 제외됨)
