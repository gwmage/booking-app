// 동시 예약 시험: 같은 슬롯에 10건을 거의 동시에 보내, 정확히 1건만 성공하는지 확인한다.
// 사용: 백엔드 실행 후 `npm run test:concurrency`
const BASE = process.env.BASE ?? 'http://localhost:3001/api';

async function main() {
  // 재실행해도 충돌 없도록 매번 다른 날짜 사용
  const r = Math.floor(Math.random() * 100000);
  const date = `2031-${String((r % 12) + 1).padStart(2, '0')}-${String((r % 28) + 1).padStart(2, '0')}`;
  const slot = '14:00';

  const requests = Array.from({ length: 10 }, (_, i) =>
    fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, slot, name: `손님${i + 1}`, phone: '010-0000-0000' }),
    }).then((res) => res.status),
  );

  const statuses = await Promise.all(requests);
  const success = statuses.filter((s) => s === 201).length;
  const conflict = statuses.filter((s) => s === 409).length;

  console.log(`대상: ${date} ${slot}`);
  console.log(`동시 요청 10건 결과 → 성공(201): ${success}건, 거절(409): ${conflict}건`);
  if (success === 1 && conflict === 9) {
    console.log('PASS: 정확히 1건만 성공, 나머지 9건 거절 — 이중 예약 방지 작동');
    process.exit(0);
  } else {
    console.log('FAIL: 이중 예약 방지가 제대로 작동하지 않음 (유일성 제약/트랜잭션 점검 필요)');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('테스트 실행 오류(백엔드가 실행 중인지 확인):', e.message);
  process.exit(1);
});
