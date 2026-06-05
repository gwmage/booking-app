const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.booking.deleteMany({});
  const slots = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
  // 오후가 더 잘 차도록 가중치
  const weight = { '10:00':1,'11:00':2,'12:00':1,'13:00':3,'14:00':5,'15:00':5,'16:00':4,'17:00':3 };
  const dates = ['2031-03-02','2031-03-03','2031-03-04','2031-03-05','2031-03-06'];
  const rows = [];
  let i = 0;
  for (const d of dates) {
    for (const s of slots) {
      // 가중치 확률로 예약 생성
      if (Math.floor((weight[s] + (s.length)) ) % 6 < weight[s]) {
        i++;
        // 상태 분포: 대부분 confirmed, 일부 canceled, 소수 noshow
        const status = i % 9 === 0 ? 'noshow' : (i % 5 === 0 ? 'canceled' : 'confirmed');
        rows.push({ date: d, slot: s, name: `손님${i}`, phone: '010-0000-0000', status });
      }
    }
  }
  for (const r of rows) await prisma.booking.create({ data: r });
  const all = await prisma.booking.findMany();
  console.log('seeded', all.length, 'confirmed', all.filter(b=>b.status==='confirmed').length,
    'canceled', all.filter(b=>b.status==='canceled').length, 'noshow', all.filter(b=>b.status==='noshow').length);
  await prisma.$disconnect();
})();
